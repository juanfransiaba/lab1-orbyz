import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";

import img1 from "../../assets/images/imagen.jpg";
import img2 from "../../assets/images/imagen2.jpg";
import img3 from "../../assets/images/imagen3.jpg";
import img4 from "../../assets/images/imagen4.jpg";
import img5 from "../../assets/images/imagen5.jpg";
import img6 from "../../assets/images/imagen6.jpg";
import img7 from "../../assets/images/imagen7.jpg";

const OAUTH_PROVIDERS = [
    { id: "google", label: "Google", badge: "G" },
    { id: "github", label: "GitHub", badge: "GH" },
];

function Login() {
    const images = [img1, img2, img3, img4, img5, img6, img7];
    const [current, setCurrent] = useState(0);
    const navigate = useNavigate();

    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrent((prev) => (prev + 1) % images.length);
        }, 3000);

        return () => clearInterval(interval);
    }, [images.length]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");

        if (!identifier || !password) {
            setError("Completa usuario/email y contrasena.");
            return;
        }

        try {
            setLoading(true);

            const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    identifier,
                    password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || "No se pudo iniciar sesion.");
                return;
            }

            localStorage.setItem("token", data.token);
            navigate("/mainmenu");
        } catch {
            setError("Error al conectar con el servidor.");
        } finally {
            setLoading(false);
        }
    };

    const handleOAuthLogin = (providerId) => {
        const apiUrl = import.meta.env.VITE_API_URL;

        if (!apiUrl) {
            setError("Falta configurar VITE_API_URL en el frontend.");
            return;
        }

        const redirectUrl = `${window.location.origin}/auth/callback`;
        window.location.href = `${apiUrl}/auth/oauth/${providerId}?redirect=${encodeURIComponent(
            redirectUrl
        )}`;
    };

    return (
        <div className="login-page">
            <section className="login-left">
                <div className="login-content">
                    <span className="login-tag">Log in</span>

                    <h1 className="login-title">Bienvenido de vuelta</h1>

                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="identifier">Correo electronico o usuario</label>
                            <input
                                type="text"
                                id="identifier"
                                placeholder="Ingresa tu email o nombre de usuario"
                                value={identifier}
                                onChange={(event) => setIdentifier(event.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Contrasena</label>
                            <input
                                type="password"
                                id="password"
                                placeholder="Ingresa tu contrasena"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                            />
                        </div>

                        {error && <p className="login-error">{error}</p>}

                        <button type="submit" className="login-button" disabled={loading}>
                            {loading ? "Ingresando..." : "Iniciar sesion"}
                        </button>
                    </form>

                    <div className="login-oauth">
                        <div className="login-oauth-divider">
                            <span>O entra con</span>
                        </div>
                        <div className="login-oauth-grid">
                            {OAUTH_PROVIDERS.map((provider) => (
                                <button
                                    type="button"
                                    key={provider.id}
                                    className={`login-oauth-button is-${provider.id}`}
                                    onClick={() => handleOAuthLogin(provider.id)}
                                >
                                    <span aria-hidden="true">{provider.badge}</span>
                                    {provider.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="login-links">
                        <p>
                            No tenes cuenta? <Link to="/register">Registrarse</Link>
                        </p>
                        <p>
                            Olvidaste tu contrasena? <Link to="/recover">Recuperar</Link>
                        </p>
                    </div>
                </div>
            </section>

            <section className="login-right">
                {images.map((img, index) => (
                    <img
                        key={img}
                        src={img}
                        alt="Login visual"
                        className={`login-image ${index === current ? "active" : ""}`}
                    />
                ))}
            </section>
        </div>
    );
}

export default Login;
