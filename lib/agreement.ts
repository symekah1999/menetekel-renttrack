import type { TenantDetails } from "./tenants";

/** The values printed into the agreement. A blank value prints as a line to fill by hand. */
export interface AgreementFields {
  name: string;
  idNo: string;
  workplace: string;
  phone: string;
  room: string;
}

export function agreementFields(floor: number, unit: string, d: Pick<TenantDetails, "tenant" | "idNo" | "workplace" | "phone">): AgreementFields {
  return {
    name: d.tenant,
    idNo: d.idNo,
    workplace: d.workplace,
    phone: d.phone,
    room: `${unit}, Floor ${floor}`,
  };
}

export const LETTERHEAD = ["MENETEKEL APARTMENTS", "P.O. BOX 3673-00100", "NAIROBI."];
export const REF_LINE = "REF: TENANCY AGREEMENT- LR NO. 848011213";
export const INTRO_BEFORE_ROOM = "I agree and confirm that room no ";
export const INTRO_AFTER_ROOM = " shall be let subject to my consent to the following terms and conditions:";

export interface Clause { n: number; text: string; sub?: string[] }

/**
 * The agreement wording, from the signed form. Only plain typing slips were corrected
 * (for example "mono's" to "month's", "exist" to "exit"); everything else is as written.
 */
export const CLAUSES: Clause[] = [
  { n: 1, text: "The calendar monthly rent payable in advance without any deductions whatsoever." },
  { n: 2, text: "A sum equal to one month's rent shall be paid to the landlord as deposit for the period of the tenancy and to be increased as monthly rent is reviewed upwards. Such deposits shall be non-interest earning and be refunded to me on termination provided that I have complied with all the terms and conditions of this agreement. The deposit shall be used to compensate for any damages in the house caused by my negligence all with destruction if any." },
  { n: 3, text: "The monthly rent is payable on the first day of the month or the fifth day of every month." },
  { n: 4, text: "I shall not use the premises for any purpose other than as a private residence." },
  { n: 5, text: "I shall not transfer or sub-rent the room at any time without the prior approval of the landlord." },
  { n: 6, text: "In the event of vacating the premises, I shall give 1 month written notice in advance and shall vacate the house before 1st of the month following notice expiry. I agree that failure to give the required notice, no deposit refund shall be paid to me." },
  { n: 7, text: "I agree to be held responsible for any damages which might occur in the house during the tenancy to the satisfaction of the landlord." },
  { n: 8, text: "I agree that at no time shall the deposit held be converted to monthly rent." },
  { n: 9, text: "I will not make additions, alterations or repairs to the house without written consent of the landlord. The house shall be maintained in a good tenantable state." },
  { n: 10, text: "I agree not to be wasteful in the usage of utilities like water while enjoying them as tenants." },
  { n: 11, text: "I understand that the gate will be closed at 11.00 pm daily and opened as from 5.00 am the following day. Any entry and exit within those times will be restricted. Ensure that the Gate remains shut throughout." },
  {
    n: 12,
    text: "I agree that the landlord reserves the right to evict me without any notice if:",
    sub: [
      "I pose any danger to the other tenants.",
      "I behave in a manner that will bring disrespect to other members of the society.",
      "I engage in criminal activities as defined in Kenyan Laws.",
      "I fail to honor my monthly payments.",
      "I fail to observe and adhere to conditions pertaining to the tenants generally.",
      "I agree to observe the highest standard of hygiene while residing in the premises, Garbage should be disposed at designated places and washrooms should be used properly.",
    ],
  },
];

export const ACCEPT_BEFORE = "I";
export const ACCEPT_AFTER = " accept and consent to the tenancy terms and conditions herein above.";

export const roman = (i: number) => ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii"][i] ?? String(i + 1);
