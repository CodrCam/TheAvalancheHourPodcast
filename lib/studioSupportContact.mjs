const DEFAULT_SUPPORT_CONTACT = Object.freeze({
  name: 'Cameron Griffin',
  email: 'ct.griffin7@gmail.com',
  phone: '425-786-4328',
});

function cleanName(value, fallback) {
  const name = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return name || fallback;
}

function cleanEmail(value, fallback) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : fallback;
}

function cleanPhone(value, fallback) {
  const digits = String(value || '').replace(/\D/g, '');
  const normalizedDigits =
    digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;

  if (normalizedDigits.length !== 10) return fallback;

  return `${normalizedDigits.slice(0, 3)}-${normalizedDigits.slice(
    3,
    6
  )}-${normalizedDigits.slice(6)}`;
}

export function getStudioSupportContact(environment = process.env) {
  const name = cleanName(
    environment.STUDIO_SUPPORT_NAME,
    DEFAULT_SUPPORT_CONTACT.name
  );
  const email = cleanEmail(
    environment.STUDIO_SUPPORT_EMAIL,
    DEFAULT_SUPPORT_CONTACT.email
  );
  const phone = cleanPhone(
    environment.STUDIO_SUPPORT_PHONE,
    DEFAULT_SUPPORT_CONTACT.phone
  );

  return {
    name,
    email,
    phone,
    phone_href: `+1${phone.replace(/\D/g, '')}`,
  };
}
