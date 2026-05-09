import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Register.css";

import img1 from "../../assets/images/imagen.jpg";
import img2 from "../../assets/images/imagen2.jpg";
import img3 from "../../assets/images/imagen3.jpg";
import img4 from "../../assets/images/imagen4.jpg";
import img5 from "../../assets/images/imagen5.jpg";
import img6 from "../../assets/images/imagen6.jpg";
import img7 from "../../assets/images/imagen7.jpg";

const PASSWORD_REQUIREMENTS_TEXT =
    "La contrasena debe tener al menos 8 caracteres, incluir un numero y un caracter especial.";

function Register() {
    const images = [img1, img2, img3, img4, img5, img6, img7];
    const [current, setCurrent] = useState(0);

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrent((prev) => (prev + 1) % images.length);
        }, 3000);

        return () => clearInterval(interval);
    }, [images.length, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!name || !email || !password || !confirmPassword) {
            setError("Completa todos los campos.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Las contrasenas no coinciden.");
            return;
        }

        if (
            password.length < 8 ||
            !/[0-9]/.test(password) ||
            !/[^A-Za-z0-9]/.test(password)
        ) {
            setError("La contrasena no cumple los requisitos indicados.");
            return;
        }

        const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!USERNAME_REGEX.test(name)) {
            setError(
                "El usuario debe tener entre 3 y 20 caracteres (solo letras, numeros y guion bajo)."
            );
            return;
        }

        if (!EMAIL_REGEX.test(email)) {
            setError("El email no tiene un formato valido.");
            return;
        }

        try {
            setLoading(true);

            const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
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
                if (
                    data.message === "La contraseÃ±a es invÃ¡lida" ||
                    data.message?.startsWith("La contraseÃ±a debe") ||
                    data.message === "La contrasena es invalida" ||
                    data.message?.startsWith("La contrasena debe")
                ) {
                    setError("La contrasena no cumple los requisitos indicados.");
                    return;
                }

                setError(data.message || "No se pudo registrar el usuario.");
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
        <div className="register-page">
            <section className="register-left">
                <div className="register-content">
                    <span className="register-tag">Register</span>

                    <h1 className="register-title">Crear cuenta</h1>

                    <form className="register-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="name">Nombre</label>
                            <input
                                type="text"
                                id="name"
                                placeholder="Ingresa tu nombre"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Correo electronico</label>
                            <input
                                type="email"
                                id="email"
                                placeholder="Ingresa tu correo"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="form-group register-password-group">
                            <label htmlFor="password">Contrasena</label>
                            <input
                                type="password"
                                id="password"
                                placeholder="Ingresa tu contrasena"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <p className="register-field-hint register-password-hint">
                                {PASSWORD_REQUIREMENTS_TEXT}
                            </p>
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirm-password">Confirmar contrasena</label>
                            <input
                                type="password"
                                id="confirm-password"
                                placeholder="Repeti tu contrasena"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>

                        {error && <p className="register-error">{error}</p>}

                        <button type="submit" className="register-button" disabled={loading}>
                            {loading ? "Registrando..." : "Registrarse"}
                        </button>
                    </form>

                    <div className="register-links">
                        <p>
                            Ya tenes cuenta? <Link to="/login">Iniciar sesion</Link>
                        </p>
                    </div>
                </div>
            </section>

            <section className="register-right">
                {images.map((img, index) => (
                    <img
                        key={index}
                        src={img}
                        alt="Register visual"
                        className={`register-image ${index === current ? "active" : ""}`}
                    />
                ))}
            </section>
        </div>
    );
}

export default Register;
