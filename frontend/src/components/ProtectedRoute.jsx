import { Navigate, useLocation } from "react-router-dom";

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
    const location = useLocation();
    const token = localStorage.getItem("token");

    const loginTo = `/login?redirect=${encodeURIComponent(
        location.pathname + location.search
    )}`;

    if (!token) {
        return <Navigate to={loginTo} replace />;
    }

    const payload = decodeToken(token);

    if (!payload) {
        localStorage.removeItem("token");
        return <Navigate to={loginTo} replace />;
    }

    if (payload.exp && payload.exp * 1000 < new Date().getTime()) {
        localStorage.removeItem("token");
        return <Navigate to={loginTo} replace />;
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
