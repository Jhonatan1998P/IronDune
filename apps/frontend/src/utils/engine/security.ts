
import { GameState } from '../../types';

// --- ARQUITECTURA DE SEGURIDAD ---
// 1. LA SAL (SALT):
// Esta constante nunca se guarda en el archivo. Vive solo en el código de la aplicación.
// Actúa como una "llave" para validar que los datos no fueron alterados externamente.
const SECRET_SALT = "IRON_DUNE_COMMANDER_ONLY_8823_X_ALPHA_v1";

// Separador único para dividir los datos JSON de la firma de seguridad dentro de la cadena encriptada.
const SEPARATOR = "||SECURE_HASH||";

/**
 * Genera una firma hash (DJB2 Variant) basada en el contenido + la SAL secreta.
 * Si el contenido cambia aunque sea un caracter, este hash cambiará radicalmente.
 */
const generateSignature = (content: string): string => {
    let h = 0xdeadbeef;
    // Aquí ocurre la magia: Combinamos los datos del usuario con nuestra SAL secreta.
    const str = content + SECRET_SALT;
    
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
    }
    return ((h ^ h >>> 16) >>> 0).toString(16);
};

/**
 * EXPORTAR:
 * 1. Convierte el estado a JSON.
 * 2. Genera la firma usando (JSON + SAL).
 * 3. Concatena: JSON + SEPARADOR + FIRMA.
 * 4. Codifica todo a Base64 para ofuscarlo visualmente.
 */
export const encodeSaveData = (state: GameState): string => {
    try {
        const jsonString = JSON.stringify(state);
        const signature = generateSignature(jsonString);
        
        // Empaquetado: Datos + Separador + Firma
        const payload = `${jsonString}${SEPARATOR}${signature}`;
        
        // Codificación Base64 (con soporte para caracteres especiales/Unicode)
        return btoa(unescape(encodeURIComponent(payload)));
    } catch (e) {
        console.error("Error de seguridad al codificar:", e);
        return "";
    }
};

/**
 * IMPORTAR:
 * 1. Decodifica el Base64.
 * 2. Separa los datos (JSON) de la firma que trae el archivo.
 * 3. Valida la integridad, pero PERMITE cargar si el JSON es válido aunque la firma falle.
 */
export const decodeSaveData = (encodedString: string): GameState | null => {
    // Limpiar espacios en blanco que pueden venir del copy-paste o editores
    let cleanStr = encodedString.trim();

    // 0. Manejo de Data URI (común al copiar desde la barra de direcciones o descargas)
    if (cleanStr.includes(",")) {
        const split = cleanStr.split(",");
        // Si tiene cabecera data:base64, tomamos la segunda parte
        if (split[0].includes("base64")) {
            cleanStr = split[1];
        }
    }

    // 1. FAST CHECK: Si empieza con '{', asumimos que es un archivo Legacy (JSON plano sin firmar)
    if (cleanStr.startsWith('{')) {
        try {
            console.log("Detectado formato Legacy (JSON). Intentando importar...");
            return JSON.parse(cleanStr);
        } catch (e) {
            console.error("Fallo al importar Legacy JSON:", e);
            return null;
        }
    }

    try {
        // Sanitization: Remove any character that is NOT valid Base64 (A-Z, a-z, 0-9, +, /, =)
        // Also normalize URL-safe base64 just in case (- -> +, _ -> /)
        cleanStr = cleanStr.replace(/-/g, '+').replace(/_/g, '/');
        cleanStr = cleanStr.replace(/[^A-Za-z0-9+/=]/g, "");

        // FIX: Ensure padding is correct for atob
        // Base64 length must be a multiple of 4. Pad with '=' if needed.
        while (cleanStr.length % 4 !== 0) {
            cleanStr += '=';
        }

        // 2. Decodificar Base64 (Manejo robusto de Unicode)
        const decodedPayload = decodeURIComponent(escape(atob(cleanStr)));
        
        // 3. Separar componentes
        const parts = decodedPayload.split(SEPARATOR);
        
        let jsonString = "";

        if (parts.length === 2) {
            // Formato correcto: Datos + Firma
            const [data, importedSignature] = parts;
            jsonString = data;

            // Verificación de Integridad (Soft Check)
            const calculatedSignature = generateSignature(jsonString);
            if (importedSignature !== calculatedSignature) {
                console.warn("ALERTA DE SEGURIDAD: La firma del archivo no coincide. Se intentará cargar de todos modos.");
            }
        } else {
            // Formato sin separador (quizás una versión muy antigua o corrupta pero con JSON válido)
            console.warn("Formato sin firma detectado. Intentando parsear contenido completo.");
            jsonString = decodedPayload;
        }

        // 4. Parsear JSON
        const state = JSON.parse(jsonString);

        // Validación estructural mínima
        if (!state || typeof state !== 'object' || !state.resources) {
            throw new Error("Estructura de datos inválida.");
        }

        return state;

    } catch (e) {
        console.error("Fallo crítico al decodificar save data:", e);
        return null;
    }
};
