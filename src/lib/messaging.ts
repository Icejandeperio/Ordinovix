import type { Channel, Language, CopyForm, TaskLine } from '@/domain/types';
import { copyFormLabel } from '@/domain/labels';
import { formatDate } from './format';

export interface MessageVariables {
  contactName?: string;
  clientName?: string;
  taskTitle?: string;
  period?: string;
  lines?: TaskLine[];
  dueDate?: string;
  deadlineDate?: string;
  operatorName?: string;
}

// Standard GSM 7-bit default alphabet + extension set
const GSM7_CHARS = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€"
);

export function isGsm7Text(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (!GSM7_CHARS.has(text[i])) {
      return false;
    }
  }
  return true;
}

export interface SmsCalculation {
  charCount: number;
  segmentCount: number;
  isGsm7: boolean;
  maxPerSegment: number;
  charsRemainingInSegment: number;
}

/**
 * Calculates SMS character count and multipart segmentation according to Spec 11.8:
 * - 160 characters fit one GSM-7 message, longer texts split into parts of 153.
 * - Non-GSM-7 (Unicode) characters reduce limits to 70 and 67.
 */
export function calculateSmsSegments(text: string): SmsCalculation {
  const charCount = text.length;
  if (charCount === 0) {
    return {
      charCount: 0,
      segmentCount: 0,
      isGsm7: true,
      maxPerSegment: 160,
      charsRemainingInSegment: 160,
    };
  }

  const isGsm = isGsm7Text(text);

  if (isGsm) {
    if (charCount <= 160) {
      return {
        charCount,
        segmentCount: 1,
        isGsm7: true,
        maxPerSegment: 160,
        charsRemainingInSegment: 160 - charCount,
      };
    }
    const segmentCount = Math.ceil(charCount / 153);
    const charsInLast = charCount % 153 === 0 ? 153 : charCount % 153;
    return {
      charCount,
      segmentCount,
      isGsm7: true,
      maxPerSegment: 153,
      charsRemainingInSegment: 153 - charsInLast,
    };
  }

  // UCS-2 / Unicode
  if (charCount <= 70) {
    return {
      charCount,
      segmentCount: 1,
      isGsm7: false,
      maxPerSegment: 70,
      charsRemainingInSegment: 70 - charCount,
    };
  }
  const segmentCount = Math.ceil(charCount / 67);
  const charsInLast = charCount % 67 === 0 ? 67 : charCount % 67;
  return {
    charCount,
    segmentCount,
    isGsm7: false,
    maxPerSegment: 67,
    charsRemainingInSegment: 67 - charsInLast,
  };
}

/**
 * Renders items as a numbered list with copy form and any flag note.
 * e.g.
 * 1) Signed 2307s from payors (original)
 * 2) Quarterly payee data — September missing
 */
export function formatItemsList(lines: TaskLine[]): string {
  if (!lines || lines.length === 0) return '(No specific items selected)';
  return lines
    .map((line, idx) => {
      const copyStr = line.copyForm ? ` (${copyFormLabel(line.copyForm).toLowerCase()})` : '';
      const flagStr = line.flagNote ? ` — ${line.flagNote}` : '';
      return `${idx + 1}) ${line.label}${copyStr}${flagStr}`;
    })
    .join('\n');
}

/**
 * Interpolates template placeholders per Spec 11.8:
 * {{contact}}, {{client}}, {{task}}, {{period}}, {{items}}, {{due}}, {{deadline}}, {{operator}}
 */
export function interpolatePlaceholders(template: string, vars: MessageVariables): string {
  let result = template;

  const contactVal = vars.contactName || 'Client';
  const clientVal = vars.clientName || 'Client';
  const taskVal = vars.taskTitle || 'Tax Obligation';
  const periodVal = vars.period || 'current period';
  const itemsVal = vars.lines ? formatItemsList(vars.lines) : '(Document requirements)';
  const dueVal = vars.dueDate ? formatDate(vars.dueDate) : 'soon';
  const deadlineVal = vars.deadlineDate ? formatDate(vars.deadlineDate) : 'statutory deadline';
  const operatorVal = vars.operatorName || 'Santos Tax Services';

  result = result.replace(/\{\{contact\}\}/g, contactVal);
  result = result.replace(/\{\{client\}\}/g, clientVal);
  result = result.replace(/\{\{task\}\}/g, taskVal);
  result = result.replace(/\{\{period\}\}/g, periodVal);
  result = result.replace(/\{\{items\}\}/g, itemsVal);
  result = result.replace(/\{\{due\}\}/g, dueVal);
  result = result.replace(/\{\{deadline\}\}/g, deadlineVal);
  result = result.replace(/\{\{operator\}\}/g, operatorVal);

  return result;
}

export function buildChannelIntent(channel: Channel, text: string, contactInfo?: { phone?: string; email?: string }): string | null {
  switch (channel) {
    case 'sms':
      return `sms:${contactInfo?.phone || ''}?body=${encodeURIComponent(text)}`;
    case 'email':
      return `mailto:${contactInfo?.email || ''}?subject=${encodeURIComponent('Tax Document Follow-up')}&body=${encodeURIComponent(text)}`;
    case 'viber':
      return `viber://forward?text=${encodeURIComponent(text)}`;
    default:
      return null;
  }
}
