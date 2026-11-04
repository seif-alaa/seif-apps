/**
 * Which builder composition each finished piece corresponds to (product id -> share-link value:
 * family.case.bezel.dial.hands.band). "Customize this" opens /build with it preloaded when every part
 * exists; otherwise it opens the builder at the first step. TODO: map the rest as their parts arrive.
 */
export const PRODUCT_BUILDS: Record<string, string> = {
  "p-gmt": "GM.case_DV_steel.bezel_GM_black_grey.dial_GM_lume_black.hands_SKX_mercedes.bracelet_SKX_jubilee_steel",
  "p-wave-diver": "DV.case_DV_steel.bezel_DV_green_ceramic.dial_DV_lume_black.hands_SKX_mercedes.bracelet_SKX_oyster_steel",
};
