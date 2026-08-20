import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import nodemailer from 'nodemailer';
import guestApplicationHandler from '../pages/api/guest-application.js';
import contactHandler from '../pages/api/contact.js';

const guestRoutePath = new URL(
  '../pages/api/guest-application.js',
  import.meta.url
);
const contactRoutePath = new URL('../pages/api/contact.js', import.meta.url);

for (const [label, routePath, actionPattern] of [
  ['guest application', guestRoutePath, /action: 'guest_application'/],
  [
    'contact and sponsorship',
    contactRoutePath,
    /action: isSponsorship \? 'sponsorship' : 'contact'/,
  ],
]) {
  test(`${label} screens bots before creating an email transporter`, async () => {
    const source = await readFile(routePath, 'utf8');
    const protection = source.lastIndexOf('protectPublicFormRequest');
    const contentScreen = source.lastIndexOf('assessPublicFormSpam');
    const humanCheck = source.lastIndexOf('verifyPublicFormHuman');
    const transporter = source.indexOf('nodemailer.createTransport');
    const sendMail = source.indexOf('sendMail(');

    assert.ok(protection >= 0);
    assert.ok(contentScreen > protection);
    assert.ok(humanCheck > contentScreen);
    assert.ok(transporter > humanCheck);
    assert.ok(sendMail > transporter);
    assert.match(source, actionPattern);
    assert.match(source, /windowMs: 60 \* 60 \* 1000/);
  });
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

function spamRequest(body, address) {
  return {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
    socket: { remoteAddress: address },
  };
}

test(
  'randomized Guest, Contact, and Sponsorship payloads trigger zero emails',
  { concurrency: false },
  async () => {
    const originalCreateTransport = nodemailer.createTransport;
    let transporterCreations = 0;
    let emailCalls = 0;
    nodemailer.createTransport = () => {
      transporterCreations += 1;
      return {
        sendMail: async () => {
          emailCalls += 1;
        },
      };
    };

    try {
      const common = {
        name: 'xXvfLkThrISiaiBaNiNtdIG',
        email: 'o.roz.i.y.i.r.0.8@gmail.com',
        website: '',
        turnstileToken: '',
      };
      const guestResponses = [];
      for (const [background, address] of [
        ['Xdgzyupuz', '203.0.113.30'],
        ['XdgzyupuzLkThrISiaiBaNiNtdIG', '203.0.113.31'],
      ]) {
        const guestResponse = responseRecorder();
        await guestApplicationHandler(
          spamRequest(
            {
              ...common,
              background,
              topics: 'NxlRZoZFvgYWGqXOlgjivzaf',
              contact: '7158982989',
            },
            address
          ),
          guestResponse
        );
        guestResponses.push(guestResponse);
      }

      for (const [isSponsorship, address] of [
        [false, '203.0.113.32'],
        [true, '203.0.113.33'],
      ]) {
        const contactResponse = responseRecorder();
        await contactHandler(
          spamRequest(
            {
              ...common,
              message: 'XdgzyupuzLkThrISiaiBaNiNtdIG',
              isSponsorship,
              companyName: isSponsorship ? 'NxlRZoZFvgYWGqXOlgjivzaf' : '',
              sponsorshipGoals: isSponsorship
                ? 'XdgzyupuzLkThrISiaiBaNiNtdIG'
                : '',
            },
            address
          ),
          contactResponse
        );
        assert.equal(contactResponse.statusCode, 200);
      }

      assert.deepEqual(
        guestResponses.map((response) => response.statusCode),
        [200, 200]
      );
      assert.equal(transporterCreations, 0);
      assert.equal(emailCalls, 0);
    } finally {
      nodemailer.createTransport = originalCreateTransport;
    }
  }
);

test(
  'verified legitimate Guest, Contact, and Sponsorship submissions still send normally',
  { concurrency: false },
  async () => {
    const originalCreateTransport = nodemailer.createTransport;
    const originalFetch = globalThis.fetch;
    let transporterCreations = 0;
    const sentMail = [];
    nodemailer.createTransport = () => {
      transporterCreations += 1;
      return {
        sendMail: async (message) => {
          sentMail.push(message);
        },
      };
    };
    globalThis.fetch = async (_url, options) => {
      const body = new URLSearchParams(String(options.body));
      const token = body.get('response');
      const action = {
        'guest-token': 'guest_application',
        'contact-token': 'contact',
        'sponsor-token': 'sponsorship',
      }[token];
      return {
        ok: true,
        json: async () => ({ success: Boolean(action), action }),
      };
    };

    try {
      const guestResponse = responseRecorder();
      await guestApplicationHandler(
        spamRequest(
          {
            name: 'Anaïs O’Connor-López',
            email: 'anais@example.com',
            background:
              'I guide backcountry skiers and teach avalanche courses throughout the winter.',
            topics: 'Decision making and communication in avalanche terrain',
            contact: '+33 6 12 34 56 78',
            website: '',
            turnstileToken: 'guest-token',
          },
          '203.0.113.41'
        ),
        guestResponse
      );
      assert.equal(guestResponse.statusCode, 200);

      for (const [isSponsorship, token, address] of [
        [false, 'contact-token', '203.0.113.42'],
        [true, 'sponsor-token', '203.0.113.43'],
      ]) {
        const contactResponse = responseRecorder();
        await contactHandler(
          spamRequest(
            {
              name: 'Jordan Lee',
              email: 'jordan@example.com',
              subject: isSponsorship ? 'Season partnership' : 'Episode question',
              message:
                'I would like to connect with the team about an upcoming episode and share a few useful details.',
              isSponsorship,
              companyName: isSponsorship ? 'Mountain Partner Co' : '',
              sponsorshipBudget: isSponsorship ? 'To be discussed' : '',
              sponsorshipGoals: isSponsorship
                ? 'Support practical avalanche education for the wider community.'
                : '',
              website: '',
              turnstileToken: token,
            },
            address
          ),
          contactResponse
        );
        assert.equal(contactResponse.statusCode, 200);
      }

      assert.equal(transporterCreations, 3);
      assert.equal(sentMail.length, 6);
    } finally {
      nodemailer.createTransport = originalCreateTransport;
      globalThis.fetch = originalFetch;
    }
  }
);
