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

function Login() {
    const images = [img1, img2, img3, img4, img5, img6, img7];
    const [current, setCurrent] = useState(0);
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrent((prev) => (prev + 1) % images.length);
        }, 3000);

        return () => clearInterval(interval);
    }, [images.length]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!email || !password) {
            setError("Completá email y contraseña.");
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
                    username: name,
                    email,
                    password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || "No se pudo iniciar sesión.");
                return;
            }

            localStorage.setItem("token", data.token);
            navigate("/mainmenu");
        } catch (err) {
            setError("Error al conectar con el servidor.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <section className="login-left">
                <div className="login-content">
                    <span className="login-tag">Log in</span>

                    <h1 className="login-title">Bienvenido de vuelta</h1>

                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="name">Nombre</label>
                            <input
                                type="text"
                                id="name"
                                placeholder="Ingresá tu nombre"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Correo electrónico</label>
                            <input
                                type="email"
                                id="email"
                                placeholder="Ingresá tu correo"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Contraseña</label>
                            <input
                                type="password"
                                id="password"
                                placeholder="Ingresá tu contraseña"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        {error && <p className="login-error">{error}</p>}

                        <button type="submit" className="login-button" disabled={loading}>
                            {loading ? "Ingresando..." : "Iniciar sesión"}
                        </button>
                    </form>

                    <div className="login-links">
                        <p>
                            No tenés cuenta? <Link to="/register">Registrarse</Link>
                        </p>
                        <p>
                            ¿Olvidaste tu contraseña? <Link to="/recover">Recuperar</Link>
                        </p>
                    </div>
                </div>
            </section>

            <section className="login-right">
                {images.map((img, index) => (
                    <img
                        key={index}
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