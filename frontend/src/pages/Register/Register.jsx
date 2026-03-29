import { useEffect, useState } from "react";
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

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrent((prev) => (prev + 1) % images.length);
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="register-page">
            <section className="register-left">
                <div className="register-content">
                    <span className="register-tag">Register</span>

                    <h1 className="register-title">Crear cuenta</h1>

                    <form className="register-form">
                        <div className="form-group">
                            <label htmlFor="name">Nombre</label>
                            <input type="text" id="name" placeholder="Ingresá tu nombre" />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Correo electrónico</label>
                            <input
                                type="email"
                                id="email"
                                placeholder="Ingresá tu correo"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Contraseña</label>
                            <input
                                type="password"
                                id="password"
                                placeholder="Ingresá tu contraseña"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirm-password">Confirmar contraseña</label>
                            <input
                                type="password"
                                id="confirm-password"
                                placeholder="Repetí tu contraseña"
                            />
                        </div>

                        <button type="submit" className="register-button">
                            Registrarse
                        </button>
                    </form>

                    <div className="register-links">
                        <p>
                            ¿Ya tenés cuenta? <a href="/login">Iniciar sesión</a>
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
                        className={`register-image ${
                            index === current ? "active" : ""
                        }`}
                    />
                ))}
            </section>
        </div>
    );
}

export default Register;