// Letterhead details printed on every order form and invoice. Kept in one place so a change of
// address or phone number is a one-line edit, not a hunt through two templates.
//
// The logos are the placeholder wordmarks in ../assets. To use the real artwork, overwrite
// logo-color.svg / logo-mono.svg (or add .png files and change the two imports below). `?inline`
// embeds the file as a data URI, which is what lets the print iframe show it without a network
// request or a relative-URL lookup.
import logoColor from "../assets/logo-color.svg?inline";
import logoMono from "../assets/logo-mono.svg?inline";

export const FIRM = {
    name: "SAKSHAM’S FASHIONS",
    tagline: "Mfg. of ladies readymade garments",
    address: [
        "(V 15-16) Ground Floor, 1st Row, Opposite A 100,",
        "Laxminarayan Industrial Estate (BRC), Udhana, Surat 394210",
    ],
    contact: "Ayush Jain",
    mobile: "9687208250",
    office: "9714282500",
    email: "Sakshamfashion7@gmail.com",
};

export const LOGO_COLOR = logoColor;
export const LOGO_MONO = logoMono;

const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const FIRM_ICONS = {
    pin: svg('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
    phone: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>'),
    office: svg('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>'),
    mail: svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>'),
};
