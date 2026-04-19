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
    }, [images.length]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!name || !email || !password || !confirmPassword) {
            setError("Completá todos los campos.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Las contraseñas no coinciden.");
            return;
        }

        if (password.length < 8) {
            setError("La contraseña debe tener al menos 8 caracteres.");
            return;
        }

        if (!/[0-9]/.test(password)) {
            setError("La contraseña debe contener al menos un número.");
            return;
        }

        if (!/[^A-Za-z0-9]/.test(password)) {
            setError("La contraseña debe contener al menos un carácter especial.");
            return;
        }

        const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!USERNAME_REGEX.test(name)) {
            setError("El usuario debe tener entre 3 y 20 caracteres (solo letras, números y guión bajo).");
            return;
        }

        if (!EMAIL_REGEX.test(email)) {
            setError("El email no tiene un formato válido.");
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
                    email: email,
                    password: password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
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

                        <div className="form-group">
                            <label htmlFor="confirm-password">Confirmar contraseña</label>
                            <input
                                type="password"
                                id="confirm-password"
                                placeholder="Repetí tu contraseña"
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
                            ¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link>
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