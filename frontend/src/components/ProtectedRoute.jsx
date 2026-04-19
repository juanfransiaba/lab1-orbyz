import { Navigate } from "react-router-dom";

function decodeToken(token) {
    try {
        const payload = token.split(".")[1];
        const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

function ProtectedRoute({ children, requiredRole }) {
    const token = localStorage.getItem("token");

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    const payload = decodeToken(token);

    if (!payload) {
        localStorage.removeItem("token");
        return <Navigate to="/login" replace />;
    }

    if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem("token");
        return <Navigate to="/login" replace />;
    }

    if (requiredRole) {
        const userRole = payload.roles ?? payload.role;

        if (userRole !== requiredRole) {
            return <Navigate to="/mainMenu" replace />;
        }
    }

    return children;
}

export default ProtectedRoute;