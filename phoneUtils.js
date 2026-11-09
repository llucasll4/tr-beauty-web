// Phone numbers are normalized to E.164 (+55DD9XXXXXXXX) for clients in Brazil.
// This checks number format and valid area codes, not SIM ownership.
const BRAZIL_AREA_CODES = new Set([
  '11','12','13','14','15','16','17','18','19',
  '21','22','24','27','28',
  '31','32','33','34','35','37','38',
  '41','42','43','44','45','46','47','48','49',
  '51','53','54','55',
  '61','62','63','64','65','66','67','68','69',
  '71','73','74','75','77','79',
  '81','82','83','84','85','86','87','88','89',
  '91','92','93','94','95','96','97','98','99',
]);

export function brazilMobileDigits(input) {
  const raw = String(input || '').replace(/\D/g, '');
  return raw.length === 13 && raw.startsWith('55') ? raw.slice(2) : raw;
}

export function normalizeBrazilMobile(input) {
  const digits = brazilMobileDigits(input);
  if (digits.length !== 11 || !BRAZIL_AREA_CODES.has(digits.slice(0, 2)) ||
      digits.charAt(2) !== '9') return null;
  return '+55' + digits;
}

export function formatBrazilMobile(input) {
  const digits = brazilMobileDigits(input).slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return '(' + digits;
  if (digits.length <= 7) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2);
  return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7);
}
