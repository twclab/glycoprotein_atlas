/* Shared scientific display tokens; does not alter the data or calculations. */
window.ATLAS_THEME = Object.freeze({
  CLASS_ORDER: Object.freeze(["high_mannose", "paucimannose", "stubs", "phospho", "undecorated", "fucosylated", "fucosylated_and_sialylated", "sialylated"]),
  CLASS_LABELS: Object.freeze({stubs: "Stubs", paucimannose: "Paucimannose", high_mannose: "High mannose", phospho: "Phospho", undecorated: "Undecorated", fucosylated: "Fucosylated", fucosylated_and_sialylated: "Fucosylated and sialylated", sialylated: "Sialylated"}),
  CLASS_COLORS: Object.freeze({stubs: "#221F20", paucimannose: "#A0E481", high_mannose: "#5A8C54", phospho: "#BDBDBD", undecorated: "#4168B9", fucosylated: "#CD4D2C", fucosylated_and_sialylated: "#CD4D2C", sialylated: "#A34599"}),
  ORGAN_COLORS: Object.freeze({brain: "#D98276", spleen: "#71B986", liver: "#A2A447", kidney: "#67AAE9", plasma: "#C977E5", myelin_male: "#4B709D", myelin_female: "#BE72A5"}),
  DIVERSITY_LABEL: "Shannon H",
});
