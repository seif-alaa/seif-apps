import type { PolicyKey } from "@/domain/settings";

/**
 * Plain-language defaults for the pages that must exist. They apply only while the policy has no text
 * in Admin → Settings; text saved there always wins. Returns, terms and care stay "being finalised"
 * until the atelier supplies its own wording (TODO: returns & cancellations terms, warranty terms).
 */
export const DEFAULT_POLICY: Partial<Record<PolicyKey, string>> = {
  shipping: [
    "We deliver across Egypt. The delivery fee for your governorate is shown at checkout, before you confirm your order, and pickup is offered where it is enabled.",
    "You pay when the order reaches you (cash on delivery) or at pickup, or by InstaPay transfer that we confirm by hand. The options available to you are shown at checkout.",
    "Each watch is assembled and tested by hand before dispatch, so the photograph you see online is a preview image. For returns and cancellations, see the Returns page or write to us from the Contact page.",
  ].join("\n\n"),
  privacy: [
    "What we collect at checkout. Your name, mobile number, email address and delivery address, and any note you add, so that we can prepare, deliver and support your order.",
    "The first-visit offer. If you use the 5% welcome offer, you give us an email address or an Egyptian mobile number. We store it with the date and whether you ticked the box to receive offers and new drops. We use it to send your code and to check, when you order, that the code is yours and has not been used before. We send offers and new drops only if you ticked the box, and you can unsubscribe at any time by contacting us.",
    "Who sees it. Your details are used by the atelier to run the shop and are not shown publicly. Payment screenshots you upload for InstaPay are kept privately and used only to confirm your payment.",
    "Your choices. You can ask to see, correct or delete the details we hold about you, or stop offers, at any time from the Contact page.",
  ].join("\n\n"),
};
