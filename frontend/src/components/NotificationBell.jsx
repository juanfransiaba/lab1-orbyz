import { useEffect, useMemo, useRef, useState } from "react";
import {
    getNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    onNewNotification,
} from "../services/NotificationService.js";
import { connectSocket } from "../services/socket.js";
import "./NotificationBell.css";

function normalizeNotification(notification) {
    let payload = notification?.payload ?? {};

    if (typeof payload === "string") {
        try {
            payload = JSON.parse(payload);
        } catch {
            payload = {};
        }
    }

    return {
        id: notification?.notification_id ?? notification?.id ?? "",
        type: notification?.type ?? "",
        payload,
        read: Boolean(notification?.read),
        createdAt: notification?.created_at ?? notification?.createdAt ?? "",
    };
}

function getNotificationText(notification) {
    if (notification.type === "ranking_passed") {
        const username = notification.payload?.passerUsername || "Un jugador";
        return `${username} te paso en el ranking`;
    }

    return "Tenes una nueva notificacion";
}

function formatNotificationDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function NotificationBell() {
    const [notifications, setNotifications] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const bellRef = useRef(null);

    useEffect(() => {
        let active = true;

        const loadNotifications = async () => {
            setLoading(true);
            setError("");

            try {
                const data = await getNotifications();

                if (active) {
                    setNotifications(
                        Array.isArray(data) ? data.map(normalizeNotification) : []
                    );
                }
            } catch (err) {
                if (active) {
                    setError(err.message || "No se pudieron cargar las notificaciones.");
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        connectSocket();
        void loadNotifications();

        const unsubscribe = onNewNotification((notification) => {
            const normalizedNotification = normalizeNotification(notification);
            setNotifications((currentNotifications) => [
                normalizedNotification,
                ...currentNotifications.filter(
                    (currentNotification) =>
                        String(currentNotification.id) !== String(normalizedNotification.id)
                ),
            ]);
        });

        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handlePointerDown = (event) => {
            if (bellRef.current && !bellRef.current.contains(event.target)) {
                setOpen(false);
            }
        };

        window.addEventListener("pointerdown", handlePointerDown);
        return () => window.removeEventListener("pointerdown", handlePointerDown);
    }, [open]);

    const unreadCount = useMemo(
        () => notifications.filter((notification) => !notification.read).length,
        [notifications]
    );

    async function handleMarkOne(notificationId) {
        if (!notificationId) {
            return;
        }

        setError("");

        try {
            await markNotificationRead(notificationId);
            setNotifications((currentNotifications) =>
                currentNotifications.map((notification) =>
                    String(notification.id) === String(notificationId)
                        ? { ...notification, read: true }
                        : notification
                )
            );
        } catch (err) {
            setError(err.message || "No se pudo marcar la notificacion.");
        }
    }

    async function handleMarkAll() {
        setError("");

        try {
            await markAllNotificationsRead();
            setNotifications((currentNotifications) =>
                currentNotifications.map((notification) => ({
                    ...notification,
                    read: true,
                }))
            );
        } catch (err) {
            setError(err.message || "No se pudieron marcar las notificaciones.");
        }
    }

    return (
        <div className="notification-bell" ref={bellRef}>
            <button
                type="button"
                className={`notification-bell-button ${open ? "is-open" : ""}`}
                onClick={() => setOpen((isOpen) => !isOpen)}
                aria-label={`Notificaciones${unreadCount ? `: ${unreadCount} sin leer` : ""}`}
                aria-expanded={open}
            >
                <span className="notification-bell-icon" aria-hidden="true" />
                {unreadCount > 0 && (
                    <span className="notification-bell-badge">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <section className="notification-bell-popover">
                    <div className="notification-bell-head">
                        <div>
                            <span>Campanita</span>
                            <h2>Notificaciones</h2>
                        </div>

                        <button
                            type="button"
                            onClick={handleMarkAll}
                            disabled={unreadCount === 0}
                        >
                            Marcar todas
                        </button>
                    </div>

                    {loading ? (
                        <div className="notification-bell-empty">
                            Cargando notificaciones...
                        </div>
                    ) : error ? (
                        <div className="notification-bell-empty is-error">{error}</div>
                    ) : notifications.length === 0 ? (
                        <div className="notification-bell-empty">
                            Todavia no tenes notificaciones.
                        </div>
                    ) : (
                        <div className="notification-bell-list">
                            {notifications.map((notification) => (
                                <article
                                    className={`notification-bell-item ${
                                        notification.read ? "" : "is-unread"
                                    }`}
                                    key={notification.id || notification.createdAt}
                                >
                                    <div>
                                        <strong>{getNotificationText(notification)}</strong>
                                        {notification.payload?.newScore !== undefined && (
                                            <span>
                                                Nuevo score: {notification.payload.newScore}
                                            </span>
                                        )}
                                        <time>{formatNotificationDate(notification.createdAt)}</time>
                                    </div>

                                    {!notification.read && (
                                        <button
                                            type="button"
                                            onClick={() => handleMarkOne(notification.id)}
                                        >
                                            Leer
                                        </button>
                                    )}
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}

export default NotificationBell;
