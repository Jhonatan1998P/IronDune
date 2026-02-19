
import { TranslationDictionary } from "../../types";
import { ui } from "./ui";
import { data } from "./data";
import { features } from "./features";

export const en: TranslationDictionary = {
    ...ui,
    ...data,
    ...features
};
