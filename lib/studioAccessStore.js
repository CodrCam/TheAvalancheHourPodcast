import crypto from 'crypto';
import {
  dynamoDbRequest,
  isDynamoCredentialsConfigured,
} from './dynamoDb.js';

const BINDING_PREFIX = 'studio_profile_binding#';
const SUBJECT_BINDING_PREFIX = 'studio_profile_subject#';

function getSiteContentTableName() {
  return process.env.DYNAMODB_SITE_CONTENT_TABLE || '';
}

export function isStudioAccessStoreConfigured() {
  return !!getSiteContentTableName() && isDynamoCredentialsConfigured();
}

function bindingKey(personId) {
  return `${BINDING_PREFIX}${String(personId || '').trim()}`;
}

function subjectBindingKey(userSub) {
  const digest = crypto
    .createHash('sha256')
    .update(String(userSub || '').trim(), 'utf8')
    .digest('hex');
  return `${SUBJECT_BINDING_PREFIX}${digest}`;
}

function isConditionalFailure(error) {
  return /conditional/i.test(String(error?.message || ''));
}

function parseBinding(item = {}) {
  try {
    const value = JSON.parse(item.content_json?.S || '{}');
    return {
      person_id: String(value.person_id || '').trim(),
      user_sub: String(value.user_sub || '').trim(),
      account_email: String(value.account_email || '').trim(),
      active: value.active !== false,
      updated_at: item.updated_at?.S || '',
    };
  } catch {
    return null;
  }
}

async function getBindingItem(personId) {
  const response = await dynamoDbRequest('GetItem', {
    TableName: getSiteContentTableName(),
    Key: { content_key: { S: bindingKey(personId) } },
    ConsistentRead: true,
  });
  return response.Item || null;
}

async function getSubjectReservation(userSub) {
  const response = await dynamoDbRequest('GetItem', {
    TableName: getSiteContentTableName(),
    Key: { content_key: { S: subjectBindingKey(userSub) } },
    ConsistentRead: true,
  });
  if (!response.Item) return null;
  return {
    person_id: String(response.Item.person_id?.S || '').trim(),
    user_sub: String(response.Item.user_sub?.S || '').trim(),
  };
}

export async function listStudioBindings({ consistentRead = false } = {}) {
  if (!isStudioAccessStoreConfigured()) {
    return { bindings: [], configured: false };
  }

  const rows = [];
  let exclusiveStartKey;

  do {
    const response = await dynamoDbRequest('Scan', {
      TableName: getSiteContentTableName(),
      ProjectionExpression: '#key, #content_json, #updated_at',
      FilterExpression: 'begins_with(#key, :prefix)',
      ExpressionAttributeNames: {
        '#key': 'content_key',
        '#content_json': 'content_json',
        '#updated_at': 'updated_at',
      },
      ExpressionAttributeValues: {
        ':prefix': { S: BINDING_PREFIX },
      },
      ...(consistentRead ? { ConsistentRead: true } : {}),
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    });

    for (const item of response.Items || []) {
      const binding = parseBinding(item);
      if (binding?.person_id && binding.user_sub) rows.push(binding);
    }

    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return {
    bindings: rows.sort((a, b) =>
      a.person_id.localeCompare(b.person_id)
    ),
    configured: true,
  };
}

function normalizeBinding(value = {}) {
  const binding = {
    person_id: String(value.person_id || '').trim(),
    user_sub: String(value.user_sub || '').trim(),
    account_email: String(value.account_email || '').trim().toLowerCase(),
    active: value.active !== false,
  };

  if (!binding.person_id || !binding.user_sub) {
    throw new Error('Profile and Cognito user ID are required.');
  }
  if (
    binding.user_sub.length > 160 ||
    !/^[a-zA-Z0-9._:@-]+$/.test(binding.user_sub)
  ) {
    throw new Error('Cognito user ID has an invalid format.');
  }
  if (
    binding.account_email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(binding.account_email)
  ) {
    throw new Error('Account email has an invalid format.');
  }

  return binding;
}

export async function saveStudioBinding(value = {}) {
  if (!isStudioAccessStoreConfigured()) {
    throw new Error('Studio access storage is not configured.');
  }

  const binding = normalizeBinding(value);
  const [existing, existingProfileItem, existingSubjectReservation] =
    await Promise.all([
      listStudioBindings({ consistentRead: true }),
      getBindingItem(binding.person_id),
      getSubjectReservation(binding.user_sub),
    ]);
  const duplicateSubject = existing.bindings.find(
    (item) =>
      item.active &&
      item.user_sub === binding.user_sub &&
      item.person_id !== binding.person_id
  );
  if (
    duplicateSubject ||
    (existingSubjectReservation?.person_id &&
      existingSubjectReservation.person_id !== binding.person_id)
  ) {
    throw new Error(
      `That Cognito user is already connected to ${
        duplicateSubject?.person_id ||
        existingSubjectReservation.person_id
      }.`
    );
  }

  const existingProfile = existingProfileItem
    ? parseBinding(existingProfileItem)
    : null;
  if (
    existingProfile?.active &&
    existingProfile.user_sub !== binding.user_sub
  ) {
    throw new Error(
      'That profile is already connected to another account.'
    );
  }

  const updatedAt = new Date().toISOString();
  const reservationWasNew = !existingSubjectReservation;
  try {
    await dynamoDbRequest('PutItem', {
      TableName: getSiteContentTableName(),
      Item: {
        content_key: { S: subjectBindingKey(binding.user_sub) },
        person_id: { S: binding.person_id },
        user_sub: { S: binding.user_sub },
        updated_at: { S: updatedAt },
      },
      ConditionExpression:
        'attribute_not_exists(#key) OR #person_id = :person_id',
      ExpressionAttributeNames: {
        '#key': 'content_key',
        '#person_id': 'person_id',
      },
      ExpressionAttributeValues: {
        ':person_id': { S: binding.person_id },
      },
    });
  } catch (error) {
    if (isConditionalFailure(error)) {
      throw new Error(
        'That Cognito user is already connected to another profile.'
      );
    }
    throw error;
  }

  try {
    await dynamoDbRequest('PutItem', {
      TableName: getSiteContentTableName(),
      Item: {
        content_key: { S: bindingKey(binding.person_id) },
        content_json: { S: JSON.stringify(binding) },
        user_sub: { S: binding.user_sub },
        active: { BOOL: binding.active },
        updated_at: { S: updatedAt },
      },
      ConditionExpression:
        'attribute_not_exists(#key) OR #user_sub = :user_sub OR #active = :inactive OR attribute_not_exists(#user_sub)',
      ExpressionAttributeNames: {
        '#key': 'content_key',
        '#user_sub': 'user_sub',
        '#active': 'active',
      },
      ExpressionAttributeValues: {
        ':user_sub': { S: binding.user_sub },
        ':inactive': { BOOL: false },
      },
    });
  } catch (error) {
    if (reservationWasNew) {
      try {
        await dynamoDbRequest('DeleteItem', {
          TableName: getSiteContentTableName(),
          Key: {
            content_key: { S: subjectBindingKey(binding.user_sub) },
          },
          ConditionExpression: '#person_id = :person_id',
          ExpressionAttributeNames: {
            '#person_id': 'person_id',
          },
          ExpressionAttributeValues: {
            ':person_id': { S: binding.person_id },
          },
        });
      } catch (rollbackError) {
        console.error(
          'studio binding subject reservation rollback failed:',
          rollbackError
        );
      }
    }
    if (isConditionalFailure(error)) {
      throw new Error(
        'That profile is already connected to another account.'
      );
    }
    throw error;
  }

  if (
    existingProfile?.user_sub &&
    existingProfile.user_sub !== binding.user_sub
  ) {
    try {
      await dynamoDbRequest('DeleteItem', {
        TableName: getSiteContentTableName(),
        Key: {
          content_key: {
            S: subjectBindingKey(existingProfile.user_sub),
          },
        },
        ConditionExpression: '#person_id = :person_id',
        ExpressionAttributeNames: {
          '#person_id': 'person_id',
        },
        ExpressionAttributeValues: {
          ':person_id': { S: binding.person_id },
        },
      });
    } catch (error) {
      if (!isConditionalFailure(error)) {
        console.error(
          'studio binding old subject reservation cleanup failed:',
          error
        );
      }
    }
  }

  return { ...binding, updated_at: updatedAt };
}

export async function deleteStudioBinding(personId) {
  if (!isStudioAccessStoreConfigured()) {
    throw new Error('Studio access storage is not configured.');
  }
  const cleanPersonId = String(personId || '').trim();
  if (!cleanPersonId) throw new Error('Profile is required.');

  const existingItem = await getBindingItem(cleanPersonId);
  const existingBinding = existingItem ? parseBinding(existingItem) : null;
  await dynamoDbRequest('DeleteItem', {
    TableName: getSiteContentTableName(),
    Key: { content_key: { S: bindingKey(cleanPersonId) } },
  });

  if (existingBinding?.user_sub) {
    try {
      await dynamoDbRequest('DeleteItem', {
        TableName: getSiteContentTableName(),
        Key: {
          content_key: {
            S: subjectBindingKey(existingBinding.user_sub),
          },
        },
        ConditionExpression: '#person_id = :person_id',
        ExpressionAttributeNames: {
          '#person_id': 'person_id',
        },
        ExpressionAttributeValues: {
          ':person_id': { S: cleanPersonId },
        },
      });
    } catch (error) {
      if (!isConditionalFailure(error)) throw error;
    }
  }

  return { person_id: cleanPersonId };
}

export async function getStudioBindingForSubject(subject) {
  const cleanSubject = String(subject || '').trim();
  if (!cleanSubject) return null;
  if (!isStudioAccessStoreConfigured()) return null;

  const reservation = await getSubjectReservation(cleanSubject);
  if (reservation?.person_id) {
    const bindingItem = await getBindingItem(reservation.person_id);
    const binding = bindingItem ? parseBinding(bindingItem) : null;
    if (
      binding?.active &&
      binding.user_sub === cleanSubject &&
      binding.person_id === reservation.person_id
    ) {
      return binding;
    }
  }

  const result = await listStudioBindings();
  return (
    result.bindings.find(
      (binding) => binding.active && binding.user_sub === cleanSubject
    ) || null
  );
}
