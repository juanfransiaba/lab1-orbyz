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

    const [form, setForm] = useState({
        nombre: "",
        email: "",
        password: "",
        confirmPassword: ""
    });

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrent((prev) => (prev + 1) % images.length);
        }, 3000);

        return () => clearInterval(interval);
    }, [images.length]);

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log("Registro:", form);
        // después conectamos backend
    };

    return (
        <div className="register-page">

            {/* IZQUIERDA */}
            <section className="register-left">
                <div className="register-content">

                    <span className="register-tag">Register</span>

                    <h1 className="register-title">
                        Crear cuenta en ORBYZ
                    </h1>

                    <form className="register-form" onSubmit={handleSubmit}>

                        <div className="form-group">
                            <label>Nombre</label>
                            <input
                                type="text"
                                name="nombre"
                                placeholder="Tu nombre"
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                name="email"
                                placeholder="tu@email.com"
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label>Contraseña</label>
                            <input
                                type="password"
                                name="password"
                                placeholder="********"
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label>Confirmar contraseña</label>
                            <input
                                type="password"
                                name="confirmPassword"
                                placeholder="********"
                                onChange={handleChange}
                            />
                        </div>

                        <button className="register-button" type="submit">
                            Crear cuenta
                        </button>
                    </form>

                    <div className="register-links">
                        <p>
                            ¿Ya tenés cuenta? <a href="/login">Iniciar sesión</a>
                        </p>
                    </div>

                </div>
            </section>

            {/* DERECHA — CAROUSEL */}
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