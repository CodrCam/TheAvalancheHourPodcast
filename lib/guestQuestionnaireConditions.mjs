function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function cleanAnswer(value) {
  return String(value ?? '').trim();
}

function matchesAtomicCondition(conditionValue = {}, answersValue = {}) {
  const condition = plainObject(conditionValue);
  const key = cleanAnswer(condition.key);
  if (!key) return true;
  const answer = cleanAnswer(plainObject(answersValue)[key]);
  const allowedValues = Array.isArray(condition.values)
    ? condition.values.map(cleanAnswer)
    : Array.isArray(condition.in)
      ? condition.in.map(cleanAnswer)
      : Array.isArray(condition.equals)
        ? condition.equals.map(cleanAnswer)
        : [];
  if (allowedValues.length) return allowedValues.includes(answer);
  if (condition.answered === true) return Boolean(answer);
  if (condition.answered === false) return !answer;
  return answer === cleanAnswer(condition.equals);
}

export function guestQuestionConditionMatches(
  conditionValue = {},
  answersValue = {}
) {
  const condition = plainObject(conditionValue);
  if (Array.isArray(condition.any)) {
    return condition.any.some((item) =>
      guestQuestionConditionMatches(item, answersValue)
    );
  }
  if (Array.isArray(condition.all)) {
    return condition.all.every((item) =>
      guestQuestionConditionMatches(item, answersValue)
    );
  }
  return matchesAtomicCondition(condition, answersValue);
}

export function guestQuestionIsActive(questionValue = {}, answersValue = {}) {
  const question = plainObject(questionValue);
  if (question.visible !== true) return false;
  const condition = plainObject(question.show_when);
  if (!Object.keys(condition).length) return true;
  return guestQuestionConditionMatches(condition, answersValue);
}
