const pool = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");
const { validatePassword } = require("../utils/passwordValidator");
const { validateUsername, validateEmail } = require("../utils/userValidator");

const OAUTH_PROVIDERS = {
    google: {
        label: "Google",
        clientIdEnv: "GOOGLE_CLIENT_ID",
        clientSecretEnv: "GOOGLE_CLIENT_SECRET",
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scope: "openid email profile",
        extraAuthParams: {
            prompt: "select_account",
        },
        async getProfile(tokenSet) {
            const profile = await fetchJson("https://openidconnect.googleapis.com/v1/userinfo", {
                headers: {
                    Authorization: `Bearer ${tokenSet.access_token}`,
                },
            });

            return {
                id: profile.sub,
                email: profile.email,
                emailVerified: profile.email_verified !== false,
                usernameSource: profile.name || profile.email,
                displayName: profile.name || null,
                avatarUrl: profile.picture || null,
            };
        },
    },
    microsoft: {
        label: "Microsoft",
        clientIdEnv: "MICROSOFT_CLIENT_ID",
        clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
        authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        scope: "openid profile email User.Read",
        extraAuthParams: {
            prompt: "select_account",
        },
        async getProfile(tokenSet) {
            const profile = await fetchJson("https://graph.microsoft.com/v1.0/me", {
                headers: {
                    Authorization: `Bearer ${tokenSet.access_token}`,
                },
            });

            return {
                id: profile.id,
                email: profile.mail || profile.userPrincipalName,
                emailVerified: true,
                usernameSource: profile.displayName || profile.mail || profile.userPrincipalName,
                displayName: profile.displayName || null,
                avatarUrl: null,
            };
        },
    },
    github: {
        label: "GitHub",
        clientIdEnv: "GITHUB_CLIENT_ID",
        clientSecretEnv: "GITHUB_CLIENT_SECRET",
        authUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        scope: "read:user user:email",
        async getProfile(tokenSet) {
            const headers = {
                Authorization: `Bearer ${tokenSet.access_token}`,
                Accept: "application/vnd.github+json",
                "User-Agent": "orbyz-auth",
            };
            const [profile, emails] = await Promise.all([
                fetchJson("https://api.github.com/user", { headers }),
                fetchJson("https://api.github.com/user/emails", { headers }),
            ]);
            const primaryEmail = Array.isArray(emails)
                ? emails.find((email) => email.primary && email.verified) ||
                  emails.find((email) => email.verified)
                : null;

            return {
                id: String(profile.id),
                email: profile.email || primaryEmail?.email,
                emailVerified: Boolean(profile.email || primaryEmail?.verified),
                usernameSource: profile.login || profile.name || profile.email,
                displayName: profile.name || profile.login || null,
                avatarUrl: profile.avatar_url || null,
            };
        },
    },
};

let ensureOAuthTablesPromise = null;

function signAuthToken(user) {
    return jwt.sign(
        {
            user_id: user.user_id,
            email: user.email,
            roles: user.roles,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );
}

function getPublicBackendUrl(req) {
    if (process.env.BACKEND_PUBLIC_URL) {
        return process.env.BACKEND_PUBLIC_URL.replace(/\/+$/, "");
    }

    const protocol = req.get("x-forwarded-proto") || req.protocol || "http";
    return `${protocol}://${req.get("host")}`;
}

function isAllowedFrontendCallback(rawUrl) {
    try {
        const url = new URL(rawUrl);

        if (!["http:", "https:"].includes(url.protocol)) {
            return false;
        }

        if (process.env.FRONTEND_URL) {
            const configured = new URL(process.env.FRONTEND_URL);
            if (url.origin === configured.origin) {
                return true;
            }
        }

        return /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d+$/.test(
            url.origin
        );
    } catch {
        return false;
    }
}

function getFrontendCallbackUrl(req) {
    const requestedRedirect = String(req.query.redirect || "").trim();
    if (requestedRedirect && isAllowedFrontendCallback(requestedRedirect)) {
        return requestedRedirect;
    }

    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(
        /\/+$/,
        ""
    );
    return `${frontendUrl}/auth/callback`;
}

function redirectWithQuery(res, targetUrl, params) {
    const url = new URL(targetUrl);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, value);
        }
    });
    return res.redirect(url.toString());
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const message = data?.error_description || data?.message || data?.error;
        throw new Error(message || `Error HTTP ${response.status}`);
    }

    return data;
}

async function exchangeCodeForToken(providerConfig, code, redirectUri) {
    const body = new URLSearchParams({
        client_id: process.env[providerConfig.clientIdEnv],
        client_secret: process.env[providerConfig.clientSecretEnv],
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
    });

    return fetchJson(providerConfig.tokenUrl, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });
}

function getProvider(providerName) {
    return OAUTH_PROVIDERS[String(providerName || "").toLowerCase()] || null;
}

function ensureOAuthTables() {
    if (!ensureOAuthTablesPromise) {
        ensureOAuthTablesPromise = pool.query(`
            CREATE TABLE IF NOT EXISTS oauth_accounts (
                provider TEXT NOT NULL,
                provider_user_id TEXT NOT NULL,
                user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                email TEXT NOT NULL,
                display_name TEXT,
                avatar_url TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                PRIMARY KEY (provider, provider_user_id)
            )
        `);
    }

    return ensureOAuthTablesPromise;
}

function normalizeUsernameSource(source, email) {
    const fallback = email ? email.split("@")[0] : "orbyz_user";
    const raw = String(source || fallback)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase();

    const normalized = raw || "orbyz_user";
    const withMinLength = normalized.length >= 3 ? normalized : `${normalized}_user`;
    return withMinLength.slice(0, 20);
}

async function buildUniqueUsername(client, source, email) {
    const base = normalizeUsernameSource(source, email).slice(0, 18);

    for (let index = 0; index < 100; index += 1) {
        const suffix = index === 0 ? "" : String(index);
        const candidate = `${base}${suffix}`.slice(0, 20);
        const usernameError = validateUsername(candidate);

        if (usernameError) {
            continue;
        }

        const existing = await client.query(
            "SELECT user_id FROM users WHERE LOWER(username) = LOWER($1)",
            [candidate]
        );

        if (existing.rows.length === 0) {
            return candidate;
        }
    }

    return `user_${Date.now()}`.slice(0, 20);
}

async function findOrCreateOAuthUser(provider, profile) {
    await ensureOAuthTables();

    if (!profile.id || !profile.email || !profile.emailVerified) {
        throw new Error("No se pudo obtener un email verificado del proveedor.");
    }

    const emailError = validateEmail(profile.email);
    if (emailError) {
        throw new Error("El email del proveedor no tiene un formato valido.");
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const linkedAccount = await client.query(
            `SELECT u.user_id, u.username, u.email, u.score, u.roles
             FROM oauth_accounts oa
             JOIN users u ON u.user_id = oa.user_id
             WHERE oa.provider = $1 AND oa.provider_user_id = $2`,
            [provider, String(profile.id)]
        );

        if (linkedAccount.rows.length > 0) {
            await client.query(
                `UPDATE oauth_accounts
                 SET email = $1, display_name = $2, avatar_url = $3, updated_at = NOW()
                 WHERE provider = $4 AND provider_user_id = $5`,
                [
                    profile.email,
                    profile.displayName,
                    profile.avatarUrl,
                    provider,
                    String(profile.id),
                ]
            );
            await client.query("COMMIT");
            return linkedAccount.rows[0];
        }

        let user;
        const existingUser = await client.query(
            `SELECT user_id, username, email, score, roles
             FROM users
             WHERE LOWER(email) = LOWER($1)
             LIMIT 1`,
            [profile.email]
        );

        if (existingUser.rows.length > 0) {
            user = existingUser.rows[0];
        } else {
            const username = await buildUniqueUsername(
                client,
                profile.usernameSource,
                profile.email
            );
            const passwordHash = await bcrypt.hash(
                `${provider}:${profile.id}:${Date.now()}:${Math.random()}`,
                10
            );
            const createdUser = await client.query(
                `INSERT INTO users (username, email, password_hash, roles)
                 VALUES ($1, $2, $3, $4)
                 RETURNING user_id, username, email, score, roles`,
                [username, profile.email, passwordHash, "user"]
            );
            user = createdUser.rows[0];
        }

        await client.query(
            `INSERT INTO oauth_accounts
                (provider, provider_user_id, user_id, email, display_name, avatar_url)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (provider, provider_user_id)
             DO UPDATE SET
                user_id = EXCLUDED.user_id,
                email = EXCLUDED.email,
                display_name = EXCLUDED.display_name,
                avatar_url = EXCLUDED.avatar_url,
                updated_at = NOW()`,
            [
                provider,
                String(profile.id),
                user.user_id,
                profile.email,
                profile.displayName,
                profile.avatarUrl,
            ]
        );

        await client.query("COMMIT");
        return user;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: "Faltan datos" });
        }

        const usernameError = validateUsername(username);
        if (usernameError) {
            return res.status(400).json({ message: usernameError });
        }

        const emailError = validateEmail(email);
        if (emailError) {
            return res.status(400).json({ message: emailError });
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ message: passwordError });
        }

        const existingUser = await pool.query(
            "SELECT * FROM users WHERE email = $1 OR username = $2",
            [email, username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: "Usuario ya existe" });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, roles)
             VALUES ($1, $2, $3, $4)
             RETURNING user_id, username, email, score, roles`,
            [username, email, passwordHash, "user"]
        );

        const user = result.rows[0];
        const token = signAuthToken(user);

        res.status(201).json({
            message: "Usuario creado correctamente",
            token,
            user,
        });
    } catch (error) {
        console.error("Error en register:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const login = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ message: "Faltan datos" });
        }

        const cleanIdentifier = identifier.trim();

        const result = await pool.query(
            "SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)",
            [cleanIdentifier]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ message: "Credenciales invalidas" });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            return res.status(400).json({ message: "Credenciales invalidas" });
        }

        const token = signAuthToken(user);

        res.json({
            message: "Login exitoso",
            token,
            user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                score: user.score,
                roles: user.roles,
            },
        });
    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const startOAuthLogin = async (req, res) => {
    try {
        const providerName = String(req.params.provider || "").toLowerCase();
        const providerConfig = getProvider(providerName);

        if (!providerConfig) {
            return res.status(404).json({ message: "Proveedor no soportado" });
        }

        const clientId = process.env[providerConfig.clientIdEnv];
        const clientSecret = process.env[providerConfig.clientSecretEnv];

        if (!clientId || !clientSecret) {
            return res.status(500).json({
                message: `${providerConfig.label} no esta configurado en el servidor`,
            });
        }

        const redirectTo = getFrontendCallbackUrl(req);
        const redirectUri = `${getPublicBackendUrl(req)}/auth/oauth/${providerName}/callback`;
        const state = jwt.sign(
            {
                provider: providerName,
                redirectTo,
            },
            process.env.JWT_SECRET,
            { expiresIn: "10m" }
        );

        const authorizationUrl = new URL(providerConfig.authUrl);
        authorizationUrl.searchParams.set("client_id", clientId);
        authorizationUrl.searchParams.set("redirect_uri", redirectUri);
        authorizationUrl.searchParams.set("response_type", "code");
        authorizationUrl.searchParams.set("scope", providerConfig.scope);
        authorizationUrl.searchParams.set("state", state);

        Object.entries(providerConfig.extraAuthParams || {}).forEach(([key, value]) => {
            authorizationUrl.searchParams.set(key, value);
        });

        return res.redirect(authorizationUrl.toString());
    } catch (error) {
        console.error("Error iniciando OAuth:", error);
        return res.status(500).json({ message: "No se pudo iniciar OAuth" });
    }
};

const finishOAuthLogin = async (req, res) => {
    let redirectTo = `${(process.env.FRONTEND_URL || "http://localhost:5173").replace(
        /\/+$/,
        ""
    )}/auth/callback`;

    try {
        const providerName = String(req.params.provider || "").toLowerCase();
        const providerConfig = getProvider(providerName);

        if (!providerConfig) {
            return redirectWithQuery(res, redirectTo, {
                error: "Proveedor no soportado",
            });
        }

        const { code, state, error, error_description: errorDescription } = req.query;

        if (error) {
            return redirectWithQuery(res, redirectTo, {
                error: errorDescription || "Login cancelado",
            });
        }

        if (!code || !state) {
            return redirectWithQuery(res, redirectTo, {
                error: "Faltan datos del proveedor",
            });
        }

        const statePayload = jwt.verify(String(state), process.env.JWT_SECRET);
        if (statePayload.provider !== providerName) {
            throw new Error("Estado OAuth invalido");
        }
        redirectTo = statePayload.redirectTo || redirectTo;

        const redirectUri = `${getPublicBackendUrl(req)}/auth/oauth/${providerName}/callback`;
        const tokenSet = await exchangeCodeForToken(
            providerConfig,
            String(code),
            redirectUri
        );
        const profile = await providerConfig.getProfile(tokenSet);
        const user = await findOrCreateOAuthUser(providerName, profile);
        const token = signAuthToken(user);

        return redirectWithQuery(res, redirectTo, { token });
    } catch (error) {
        console.error("Error finalizando OAuth:", error);
        return redirectWithQuery(res, redirectTo, {
            error: error.message || "No se pudo iniciar sesion",
        });
    }
};

const logout = (req, res) => {
    res.json({ message: "Logout exitoso" });
};

module.exports = {
    register,
    login,
    logout,
    startOAuthLogin,
    finishOAuthLogin,
};
