const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const fetch = require("node-fetch");

const IMAGE_STORAGE_CONFIG = {
    paises: {
        managedUrlPrefix: "/static/paises",
        managedDir: path.join(__dirname, "..", "static", "paises"),
        legacyUrlPrefix: "/images/paises",
        legacyDir: path.join(
            __dirname,
            "..",
            "..",
            "frontend",
            "public",
            "images",
            "paises"
        ),
        fieldName: "imagen_pais",
    },
    siluetas: {
        managedUrlPrefix: "/static/siluetas",
        managedDir: path.join(__dirname, "..", "static", "siluetas"),
        legacyUrlPrefix: "/images/siluetas",
        legacyDir: path.join(
            __dirname,
            "..",
            "..",
            "frontend",
            "public",
            "images",
            "siluetas"
        ),
        fieldName: "imagen_silueta",
    },
};

const MIME_EXTENSION_MAP = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
};

const ALLOWED_EXTENSIONS = new Set(
    Object.values(MIME_EXTENSION_MAP).concat([".jpeg"])
);

class CountryImageError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = "CountryImageError";
        this.status = status;
    }
}

function slugify(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function isRemoteUrl(value) {
    return /^https?:\/\//i.test(String(value || "").trim());
}

function getStorageConfig(kind) {
    const config = IMAGE_STORAGE_CONFIG[kind];

    if (!config) {
        throw new CountryImageError(
            `No existe configuracion de almacenamiento para ${kind}.`,
            500
        );
    }

    return config;
}

function getPathnameFromValue(value) {
    const trimmedValue = String(value || "").trim();

    if (!trimmedValue) {
        return "";
    }

    if (trimmedValue.startsWith("/")) {
        return trimmedValue;
    }

    try {
        return new URL(trimmedValue).pathname || "";
    } catch (error) {
        return "";
    }
}

function getManagedPathFromInput(value, kind) {
    const config = getStorageConfig(kind);
    const pathname = getPathnameFromValue(value);

    if (pathname.startsWith(`${config.managedUrlPrefix}/`)) {
        return pathname;
    }

    return "";
}

function getLegacyPathFromInput(value, kind) {
    const config = getStorageConfig(kind);
    const pathname = getPathnameFromValue(value);

    if (pathname.startsWith(`${config.legacyUrlPrefix}/`)) {
        return pathname;
    }

    return "";
}

async function ensureStaticDir(kind) {
    const config = getStorageConfig(kind);
    await fs.mkdir(config.managedDir, { recursive: true });
}

async function fileExists(absolutePath) {
    try {
        await fs.access(absolutePath);
        return true;
    } catch (error) {
        return false;
    }
}

function getAbsolutePathFromManagedPath(publicPath, kind) {
    const config = getStorageConfig(kind);
    const relativePath = publicPath.replace(`${config.managedUrlPrefix}/`, "");
    return path.join(config.managedDir, relativePath);
}

function getAbsolutePathFromLegacyPath(publicPath, kind) {
    const config = getStorageConfig(kind);
    const relativePath = publicPath.replace(`${config.legacyUrlPrefix}/`, "");
    return path.join(config.legacyDir, relativePath);
}

function getExtensionFromContentType(contentType) {
    const normalizedType = String(contentType || "")
        .split(";")[0]
        .trim()
        .toLowerCase();

    return MIME_EXTENSION_MAP[normalizedType] || "";
}

function getExtensionFromUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const extension = path.extname(parsedUrl.pathname).toLowerCase();
        return ALLOWED_EXTENSIONS.has(extension) ? extension : "";
    } catch (error) {
        return "";
    }
}

function buildManagedPath(entityName, extension, kind) {
    const config = getStorageConfig(kind);
    const safeName =
        slugify(entityName) || `pais-${crypto.randomBytes(4).toString("hex")}`;

    return `${config.managedUrlPrefix}/${safeName}-${Date.now()}${extension}`;
}

async function removeManagedStoredImage(imageValue, kind) {
    const managedPath = getManagedPathFromInput(imageValue, kind);

    if (!managedPath) {
        return;
    }

    const absolutePath = getAbsolutePathFromManagedPath(managedPath, kind);

    if (await fileExists(absolutePath)) {
        await fs.unlink(absolutePath);
    }
}

async function resolveStoredImagePath({
    imageValue,
    entityName,
    kind,
    fieldName,
}) {
    const config = getStorageConfig(kind);
    const resolvedFieldName = fieldName || config.fieldName;
    const trimmedValue = String(imageValue || "").trim();

    if (!trimmedValue) {
        return "";
    }

    const managedPath = getManagedPathFromInput(trimmedValue, kind);

    if (managedPath) {
        const absolutePath = getAbsolutePathFromManagedPath(managedPath, kind);

        if (!(await fileExists(absolutePath))) {
            throw new CountryImageError(
                `La ruta local de ${resolvedFieldName} no existe en el servidor.`
            );
        }

        return managedPath;
    }

    const legacyPath = getLegacyPathFromInput(trimmedValue, kind);

    if (legacyPath) {
        const absolutePath = getAbsolutePathFromLegacyPath(legacyPath, kind);

        if (!(await fileExists(absolutePath))) {
            throw new CountryImageError(
                `La ruta local legacy de ${resolvedFieldName} no existe en frontend/public.`
            );
        }

        return legacyPath;
    }

    if (!isRemoteUrl(trimmedValue)) {
        throw new CountryImageError(
            `${resolvedFieldName} debe ser una URL externa valida o una ruta local existente.`
        );
    }

    let response;

    try {
        response = await fetch(trimmedValue, {
            redirect: "follow",
        });
    } catch (error) {
        throw new CountryImageError(
            `No se pudo descargar ${resolvedFieldName} desde la URL indicada.`,
            502
        );
    }

    if (!response.ok) {
        throw new CountryImageError(
            `No se pudo descargar ${resolvedFieldName} (status ${response.status}).`,
            502
        );
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.toLowerCase().startsWith("image/")) {
        throw new CountryImageError(
            `La URL de ${resolvedFieldName} no devolvio una imagen valida.`
        );
    }

    const extension =
        getExtensionFromContentType(contentType) ||
        getExtensionFromUrl(trimmedValue);

    if (!extension) {
        throw new CountryImageError(
            "No se pudo determinar la extension de la imagen descargada."
        );
    }

    await ensureStaticDir(kind);

    const publicPath = buildManagedPath(entityName, extension, kind);
    const absolutePath = getAbsolutePathFromManagedPath(publicPath, kind);
    const fileBuffer = Buffer.from(await response.arrayBuffer());

    await fs.writeFile(absolutePath, fileBuffer);

    return publicPath;
}

async function resolveCountryImagePath({ imageValue, countryName }) {
    return resolveStoredImagePath({
        imageValue,
        entityName: countryName,
        kind: "paises",
        fieldName: "imagen_pais",
    });
}

async function resolveCountrySilhouettePath({ imageValue, countryName }) {
    return resolveStoredImagePath({
        imageValue,
        entityName: countryName,
        kind: "siluetas",
        fieldName: "imagen_silueta",
    });
}

async function removeManagedCountryImage(imageValue) {
    return removeManagedStoredImage(imageValue, "paises");
}

async function removeManagedCountrySilhouette(imageValue) {
    return removeManagedStoredImage(imageValue, "siluetas");
}

module.exports = {
    resolveCountryImagePath,
    resolveCountrySilhouettePath,
    removeManagedCountryImage,
    removeManagedCountrySilhouette,
};
