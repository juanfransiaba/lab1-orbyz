import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import "./Store.css";
import storeBackground from "../../assets/images/imagen3.jpg";

const coinPacks = [
    {
        id: "starter",
        name: "Pack Inicial",
        amount: "500 monedas",
        bonus: "Sin bonus",
        price: "$999",
        grantCoins: 500,
        variant: "starter",
    },
    {
        id: "explorer",
        name: "Pack Explorador",
        amount: "1.200 monedas",
        bonus: "+100 bonus",
        price: "$1.899",
        grantCoins: 1300,
        variant: "explorer",
    },
    {
        id: "master",
        name: "Pack Maestro",
        amount: "2.800 monedas",
        bonus: "+400 bonus",
        price: "$3.999",
        grantCoins: 3200,
        variant: "master",
    },
    {
        id: "legend",
        name: "Pack Leyenda",
        amount: "6.500 monedas",
        bonus: "+1.250 bonus",
        price: "$7.999",
        grantCoins: 7750,
        variant: "legend",
    },
];

const abilities = [
    {
        id: "fifty-fifty",
        name: "Tachar 2 opciones",
        detail: "Elimina dos respuestas incorrectas de la pregunta actual.",
        cost: "300 monedas",
        costCoins: 300,
        icon: "50",
        variant: "fifty",
    },
    {
        id: "freeze",
        name: "Congelar",
        detail: "Frena la pantalla del rival durante unos segundos.",
        cost: "550 monedas",
        costCoins: 550,
        icon: "FR",
        variant: "freeze",
    },
    {
        id: "screamer",
        name: "SCREAMER",
        detail: "Lanza una imagen sorpresa y bloquea al rival por menos tiempo.",
        cost: "650 monedas",
        costCoins: 650,
        icon: "SC",
        variant: "screamer",
    },
];

const avatars = [
    {
        id: "mountain-explorer",
        name: "Explorador",
        detail: "Avatar de perfil inspirado en rutas y mapas.",
        cost: "700 monedas",
        costCoins: 700,
        icon: "EX",
        variant: "explorer",
        imageSrc: "/images/paises/indiana.jpg",
    },
    {
        id: "ocean-guide",
        name: "Perrito",
        detail: "Avatar simple y tierno para tu perfil.",
        cost: "850 monedas",
        costCoins: 850,
        icon: "PE",
        variant: "perrito",
        imageSrc: "/images/paises/perrito.jpg",
    },
    {
        id: "world-master",
        name: "Gato",
        detail: "Avatar felino para perfiles con estilo.",
        cost: "1.200 monedas",
        costCoins: 1200,
        icon: "GA",
        variant: "gato",
        imageSrc: "/images/paises/gato.jpg",
    },
    {
        id: "gigachad-mundial",
        name: "Gigachad mundial",
        detail: "Avatar premium para llevar el perfil a modo leyenda.",
        cost: "1.500 monedas",
        costCoins: 1500,
        icon: "GM",
        variant: "gigachad",
        imageSrc: "/images/paises/JulianCHAD.jpg",
    },
];

const screamerImages = [
    {
        id: "screamer",
        name: "Screamer",
        src: "/images/paises/screamer.jpg",
    },
    {
        id: "screamer-2",
        name: "Screamer 2",
        src: "/images/paises/Screamer2.jpg",
    },
];

const storeCategories = [
    {
        id: "coins",
        label: "Monedas",
        title: "Comprar monedas",
        items: coinPacks,
    },
    {
        id: "abilities",
        label: "Habilidades",
        title: "Comprar habilidades",
        items: abilities,
    },
    {
        id: "avatars",
        label: "Avatar",
        title: "Comprar avatares",
        items: avatars,
    },
];

const pendingCoinOrderKey = "orbyzPendingCoinOrder";

function getMercadoPagoReturnParams() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("orderId");

    if (!orderId) {
        return null;
    }

    return {
        orderId,
        paymentId:
            params.get("payment_id") ||
            params.get("collection_id") ||
            params.get("paymentId") ||
            "",
        status: params.get("mp_status") || params.get("status") || "",
    };
}

function getPendingCoinOrder() {
    try {
        const pendingOrder = JSON.parse(
            localStorage.getItem(pendingCoinOrderKey) || "null"
        );

        if (!pendingOrder?.orderId) {
            return null;
        }

        return pendingOrder;
    } catch {
        return null;
    }
}

function savePendingCoinOrder(order) {
    if (!order?.orderId) {
        return;
    }

    localStorage.setItem(
        pendingCoinOrderKey,
        JSON.stringify({
            orderId: order.orderId,
            createdAt: Date.now(),
        })
    );
}

function clearPendingCoinOrder(orderId) {
    const pendingOrder = getPendingCoinOrder();

    if (!pendingOrder || !orderId || pendingOrder.orderId === orderId) {
        localStorage.removeItem(pendingCoinOrderKey);
    }
}

function clearMercadoPagoReturnParams() {
    window.history.replaceState({}, "", window.location.pathname);
}

function getMercadoPagoResultDialog(order, statusHint) {
    const normalizedStatus = String(
        order?.paymentStatus || statusHint || order?.status || ""
    ).toLowerCase();
    const coins = Number(order?.coins || 0).toLocaleString("es-AR");

    if (order?.credited) {
        return {
            tone: "success",
            title: "Monedas acreditadas",
            message: `Se acreditaron ${coins} monedas en tu cuenta.`,
        };
    }

    if (
        normalizedStatus === "pending" ||
        normalizedStatus === "in_process" ||
        normalizedStatus === "pending_payment"
    ) {
        return null;
    }

    if (
        normalizedStatus === "failure" ||
        normalizedStatus === "rejected" ||
        normalizedStatus === "cancelled" ||
        normalizedStatus === "cancelled_payment"
    ) {
        return {
            tone: "error",
            title: "Pago no aprobado",
            message: "No se acreditaron monedas porque Mercado Pago no aprobo la compra.",
        };
    }

    return null;
}

function Store() {
    const navigate = useNavigate();
    const [storeState, setStoreState] = useState({
        balance: 0,
        inventory: {},
    });
    const [loading, setLoading] = useState(true);
    const [activeCategoryId, setActiveCategoryId] = useState("coins");
    const [dialog, setDialog] = useState(null);
    const [pendingPurchase, setPendingPurchase] = useState(null);
    const [screamerPicker, setScreamerPicker] = useState(null);
    const [selectedScreamerImageId, setSelectedScreamerImageId] = useState("screamer");
    const [purchasing, setPurchasing] = useState(false);
    const [storeRefreshKey, setStoreRefreshKey] = useState(0);

    useEffect(() => {
        const token = localStorage.getItem("token");

        if (!token) {
            navigate("/login");
            return;
        }

        const fetchStoreState = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/store/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                const data = await response.json();

                if (!response.ok) {
                    localStorage.removeItem("token");
                    navigate("/login");
                    return;
                }

                setStoreState({
                    balance: Number(data.balance) || 0,
                    inventory: data.inventory || {},
                });

                const mercadoPagoReturn = getMercadoPagoReturnParams();
                const pendingCoinOrder = mercadoPagoReturn || getPendingCoinOrder();

                if (pendingCoinOrder) {
                    const query = pendingCoinOrder.paymentId
                        ? `?payment_id=${encodeURIComponent(pendingCoinOrder.paymentId)}`
                        : "";
                    const statusResponse = await fetch(
                        `${import.meta.env.VITE_API_URL}/store/coins/orders/${encodeURIComponent(
                            pendingCoinOrder.orderId
                        )}${query}`,
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                        }
                    );
                    const statusData = await statusResponse.json();

                    if (statusResponse.ok) {
                        setStoreState({
                            balance: Number(statusData.balance) || 0,
                            inventory: statusData.inventory || {},
                        });
                        const resultDialog = getMercadoPagoResultDialog(
                            statusData.order,
                            pendingCoinOrder.status
                        );

                        if (
                            !resultDialog ||
                            statusData.order?.credited ||
                            resultDialog.tone === "error"
                        ) {
                            clearPendingCoinOrder(
                                statusData.order?.orderId || pendingCoinOrder.orderId
                            );
                        }

                        if (resultDialog) {
                            setDialog(resultDialog);
                        }
                    } else {
                        clearPendingCoinOrder(pendingCoinOrder.orderId);
                        setDialog({
                            tone: "error",
                            title: "No se pudo confirmar el pago",
                            message:
                                statusData.message ||
                                "La compra quedo creada, pero no pudimos consultar su estado.",
                        });
                    }

                    if (mercadoPagoReturn) {
                        clearMercadoPagoReturnParams();
                    }
                }
            } catch {
                navigate("/login");
            } finally {
                setLoading(false);
            }
        };

        void fetchStoreState();
    }, [navigate, storeRefreshKey]);

    useEffect(() => {
        const refreshPendingPayment = () => {
            if (!document.hidden && getPendingCoinOrder()) {
                setStoreRefreshKey((currentKey) => currentKey + 1);
            }
        };

        window.addEventListener("focus", refreshPendingPayment);
        document.addEventListener("visibilitychange", refreshPendingPayment);

        return () => {
            window.removeEventListener("focus", refreshPendingPayment);
            document.removeEventListener("visibilitychange", refreshPendingPayment);
        };
    }, []);

    const currentCoins = Number(storeState.balance || 0).toLocaleString("es-AR");
    const activeCategory =
        storeCategories.find((category) => category.id === activeCategoryId) || storeCategories[0];
    const pendingItem = pendingPurchase?.item;
    const pendingType = pendingPurchase?.type;

    const handleBuy = (item, type) => {
        if (purchasing) {
            return;
        }

        if (type === "avatars" && getOwnedQuantity(type, item.id) > 0) {
            return;
        }

        const balance = Number(storeState.balance) || 0;
        const costCoins = Number(item.costCoins) || 0;

        if (type !== "coins" && balance < costCoins) {
            setDialog({
                tone: "error",
                title: "Monedas insuficientes",
                message: `Necesitas ${costCoins.toLocaleString(
                    "es-AR"
                )} monedas para comprar ${item.name}. Tenes ${balance.toLocaleString(
                    "es-AR"
                )}.`,
            });
            return;
        }

        if (type === "abilities" && item.id === "screamer") {
            setSelectedScreamerImageId("screamer");
            setScreamerPicker({ item, type });
            return;
        }

        setPendingPurchase({ item, type });
    };

    const getOwnedQuantity = (type, itemId) =>
        Number(storeState.inventory?.[type]?.[itemId] || 0);

    const handleConfirmPurchase = async () => {
        if (!pendingItem || !pendingType || purchasing) {
            return;
        }

        const token = localStorage.getItem("token");

        if (!token) {
            navigate("/login");
            return;
        }

        const mercadoPagoTab =
            pendingType === "coins" ? window.open("about:blank", "_blank") : null;

        setPurchasing(true);

        try {
            if (pendingType === "coins") {
                const response = await fetch(
                    `${import.meta.env.VITE_API_URL}/store/coins/checkout`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                            itemId: pendingItem.id,
                        }),
                    }
                );
                const data = await response.json();

                if (!response.ok) {
                    mercadoPagoTab?.close();
                    setDialog({
                        tone: "error",
                        title:
                            data.code === "MERCADO_PAGO_NOT_CONFIGURED"
                                ? "Mercado Pago no configurado"
                                : data.code === "MERCADO_PAGO_UNAUTHORIZED"
                                  ? "Mercado Pago no autorizado"
                                : "No se pudo iniciar el pago",
                        message:
                            data.message ||
                            "No pudimos abrir Mercado Pago para esta compra.",
                    });
                    setPendingPurchase(null);
                    return;
                }

                const checkoutUrl = data.initPoint || data.sandboxInitPoint;

                if (!checkoutUrl) {
                    mercadoPagoTab?.close();
                    setDialog({
                        tone: "error",
                        title: "No se pudo iniciar el pago",
                        message: "Mercado Pago no devolvio un link de checkout.",
                    });
                    setPendingPurchase(null);
                    return;
                }

                savePendingCoinOrder(data.order);
                setPendingPurchase(null);

                if (mercadoPagoTab) {
                    mercadoPagoTab.opener = null;
                    mercadoPagoTab.location.href = checkoutUrl;
                    setDialog({
                        tone: "confirm",
                        title: "Mercado Pago abierto",
                        message:
                            "Abrimos el pago en otra pestana. Cuando termines, volve a Orbyz y actualizaremos tus monedas automaticamente.",
                    });
                } else {
                    window.open(checkoutUrl, "_blank", "noopener,noreferrer");
                    setDialog({
                        tone: "confirm",
                        title: "Abrir Mercado Pago",
                        message:
                            "Si no se abrio una pestana nueva, habilita las ventanas emergentes del navegador y volve a intentar.",
                    });
                }

                return;
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL}/store/purchase`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    itemType: pendingType,
                    itemId: pendingItem.id,
                    metadata:
                        pendingType === "abilities" && pendingItem.id === "screamer"
                            ? { screamerImageId: pendingPurchase.screamerImageId }
                            : {},
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setDialog({
                    tone: "error",
                    title:
                        data.code === "INSUFFICIENT_COINS"
                            ? "Monedas insuficientes"
                            : data.code === "ITEM_ALREADY_OWNED"
                              ? "Avatar obtenido"
                            : "No se pudo comprar",
                    message: data.message || "No se pudo completar la compra.",
                });
                setPendingPurchase(null);
                return;
            }

            setStoreState({
                balance: Number(data.balance) || 0,
                inventory: data.inventory || {},
            });
            setPendingPurchase(null);
            setDialog({
                tone: "success",
                title: "Compra confirmada",
                message:
                    pendingType === "coins"
                        ? `Se acreditaron ${Number(
                              pendingItem.grantCoins || 0
                          ).toLocaleString("es-AR")} monedas.`
                        : pendingItem.id === "screamer"
                          ? `${pendingItem.name} quedo guardado con la imagen seleccionada.`
                        : `${pendingItem.name} quedo guardado en tu inventario.`,
            });
        } catch {
            mercadoPagoTab?.close();
            setDialog({
                tone: "error",
                title: "Error de conexion",
                message: "No se pudo conectar con el servidor para guardar la compra.",
            });
        } finally {
            setPurchasing(false);
        }
    };

    return (
        <div
            className="store-page"
            style={{ "--store-background-image": `url(${storeBackground})` }}
        >
            <header className="store-header">
                <div className="store-header-actions">
                    <Link to="/mainmenu" className="store-back-button">
                        Volver
                    </Link>
                </div>

                <div className="store-title-wrap">
                    <span className="store-title-kicker">ORBYZ</span>
                    <h1 className="store-title">Tienda</h1>
                </div>

                <div className="store-balance" aria-label="Monedas disponibles">
                    <span className="store-balance-label">Monedas</span>
                    <strong>{loading ? "--" : currentCoins}</strong>
                </div>
            </header>

            <main className="store-main">
                <section className="store-top-panel">
                    <div className="store-top-copy">
                        <h2>Tienda de recompensas</h2>
                    </div>

                    <div className="store-coin-showcase" aria-hidden="true">
                        <span className="store-showcase-coin is-back" />
                        <span className="store-showcase-coin is-middle" />
                        <span className="store-showcase-coin is-front">O</span>
                    </div>
                </section>

                <section className="store-shop-panel">
                    <nav className="store-category-menu" aria-label="Opciones de tienda">
                        {storeCategories.map((category) => (
                            <button
                                type="button"
                                className={`store-category-button${
                                    category.id === activeCategoryId ? " is-active" : ""
                                }`}
                                key={category.id}
                                onClick={() => setActiveCategoryId(category.id)}
                            >
                                {category.label}
                            </button>
                        ))}
                    </nav>

                    <StoreCarousel
                        title={activeCategory.title}
                        items={activeCategory.items}
                        type={activeCategory.id}
                        onBuy={handleBuy}
                        ownedQuantityFor={getOwnedQuantity}
                        purchasing={purchasing}
                    />
                </section>
            </main>

            {pendingPurchase && (
                <StoreModal
                    tone="confirm"
                    title="Confirmar compra"
                    message={getPurchaseConfirmMessage(pendingItem, pendingType)}
                    primaryLabel={
                        purchasing
                            ? pendingType === "coins"
                                ? "Abriendo..."
                                : "Comprando..."
                            : pendingType === "coins"
                              ? "Ir a Mercado Pago"
                              : "Confirmar"
                    }
                    secondaryLabel="Cancelar"
                    onPrimary={handleConfirmPurchase}
                    onSecondary={() => setPendingPurchase(null)}
                    primaryDisabled={purchasing}
                    secondaryDisabled={purchasing}
                />
            )}

            {screamerPicker && (
                <ScreamerImagePicker
                    images={screamerImages}
                    selectedImageId={selectedScreamerImageId}
                    onSelect={setSelectedScreamerImageId}
                    onCancel={() => setScreamerPicker(null)}
                    onContinue={() => {
                        const selectedImage = screamerImages.find(
                            (image) => image.id === selectedScreamerImageId
                        );

                        setPendingPurchase({
                            ...screamerPicker,
                            screamerImageId: selectedImage?.id || "screamer",
                        });
                        setScreamerPicker(null);
                    }}
                />
            )}

            {dialog && (
                <StoreModal
                    tone={dialog.tone}
                    title={dialog.title}
                    message={dialog.message}
                    primaryLabel="Entendido"
                    onPrimary={() => setDialog(null)}
                />
            )}
        </div>
    );
}

function getPurchaseConfirmMessage(item, type) {
    if (!item) {
        return "";
    }

    if (type === "coins") {
        return `Te vamos a llevar a Mercado Pago para comprar ${item.name}. Se acreditaran ${Number(
            item.grantCoins || 0
        ).toLocaleString("es-AR")} monedas cuando el pago quede aprobado.`;
    }

    if (item.id === "screamer") {
        return `Vas a gastar ${Number(item.costCoins || 0).toLocaleString(
            "es-AR"
        )} monedas para comprar ${item.name} con la imagen seleccionada.`;
    }

    return `Vas a gastar ${Number(item.costCoins || 0).toLocaleString(
        "es-AR"
    )} monedas para comprar ${item.name}.`;
}

function ScreamerImagePicker({
    images,
    selectedImageId,
    onSelect,
    onCancel,
    onContinue,
}) {
    return (
        <div className="store-modal-backdrop" role="presentation">
            <section
                className="store-modal store-screamer-picker"
                role="dialog"
                aria-modal="true"
                aria-labelledby="store-screamer-title"
            >
                <h2 id="store-screamer-title">Elegir imagen del screamer</h2>
                <p>Selecciona la imagen que va a aparecerle al rival.</p>

                <div className="store-screamer-grid">
                    {images.map((image) => (
                        <button
                            type="button"
                            className={`store-screamer-option${
                                selectedImageId === image.id ? " is-selected" : ""
                            }`}
                            key={image.id}
                            onClick={() => onSelect(image.id)}
                        >
                            <img src={image.src} alt={image.name} />
                            <span>{image.name}</span>
                        </button>
                    ))}
                </div>

                <div className="store-modal-actions">
                    <button
                        type="button"
                        className="store-modal-secondary"
                        onClick={onCancel}
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        className="store-modal-primary"
                        onClick={onContinue}
                    >
                        Continuar
                    </button>
                </div>
            </section>
        </div>
    );
}

function StoreCarousel({ title, items, type, onBuy, ownedQuantityFor, purchasing }) {
    const railRef = useRef(null);

    const move = (direction) => {
        const rail = railRef.current;

        if (!rail) {
            return;
        }

        const firstCard = rail.querySelector(".store-card");
        const cardWidth = firstCard?.clientWidth || 520;

        rail.scrollBy({
            left: direction * (cardWidth + 18),
            behavior: "smooth",
        });
    };

    return (
        <section className="store-section">
            <div className="store-section-header">
                <div>
                    <h2>{title}</h2>
                </div>

                <div className="store-carousel-controls">
                    <button
                        type="button"
                        className="store-carousel-arrow"
                        onClick={() => move(-1)}
                        aria-label={`Mover ${title} hacia la izquierda`}
                    >
                        <span aria-hidden="true">&lt;</span>
                    </button>

                    <button
                        type="button"
                        className="store-carousel-arrow"
                        onClick={() => move(1)}
                        aria-label={`Mover ${title} hacia la derecha`}
                    >
                        <span aria-hidden="true">&gt;</span>
                    </button>
                </div>
            </div>

            <div className="store-carousel-rail" ref={railRef}>
                {items.map((item) => (
                    <StoreItemCard
                        item={item}
                        type={type}
                        key={item.id}
                        ownedQuantity={ownedQuantityFor(type, item.id)}
                        onBuy={onBuy}
                        purchasing={purchasing}
                    />
                ))}
            </div>
        </section>
    );
}

function StoreItemCard({ item, type, ownedQuantity, onBuy, purchasing }) {
    const isAvatarOwned = type === "avatars" && ownedQuantity > 0;

    return (
                    <article
                        className={`store-card store-card-${type} store-card-${item.variant}${
                            isAvatarOwned ? " is-owned" : ""
                        }`}
                    >
                        <div className="store-card-visual">
                            {type === "coins" ? (
                                <CoinArt variant={item.variant} />
                            ) : type === "avatars" ? (
                                <AvatarArt
                                    icon={item.icon}
                                    variant={item.variant}
                                    imageSrc={item.imageSrc}
                                    name={item.name}
                                />
                            ) : (
                                <AbilityArt icon={item.icon} variant={item.variant} />
                            )}
                        </div>

                        <div className="store-card-body">
                            <h3>{item.name}</h3>
                            {type === "coins" ? (
                                <>
                                    <p className="store-card-primary">{item.amount}</p>
                                    <p>{item.bonus}</p>
                                </>
                            ) : (
                                <p>{item.detail}</p>
                            )}
                            <span className="store-card-owned">
                                {type === "coins"
                                    ? `Compraste ${ownedQuantity}`
                                    : isAvatarOwned
                                      ? "OBTENIDO"
                                    : `Tenes ${ownedQuantity}`}
                            </span>
                        </div>

                        <div className="store-card-footer">
                            <span>{type === "coins" ? item.price : item.cost}</span>
                            <button
                                type="button"
                                onClick={() => onBuy(item, type)}
                                disabled={purchasing || isAvatarOwned}
                            >
                                {isAvatarOwned ? "Obtenido" : "Comprar"}
                            </button>
                        </div>
                    </article>
    );
}

function StoreModal({
    tone = "confirm",
    title,
    message,
    primaryLabel,
    secondaryLabel,
    onPrimary,
    onSecondary,
    primaryDisabled = false,
    secondaryDisabled = false,
}) {
    return (
        <div className="store-modal-backdrop" role="presentation">
            <section
                className={`store-modal store-modal-${tone}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="store-modal-title"
            >
                <h2 id="store-modal-title">{title}</h2>
                <p>{message}</p>

                <div className="store-modal-actions">
                    {secondaryLabel && (
                        <button
                            type="button"
                            className="store-modal-secondary"
                            onClick={onSecondary}
                            disabled={secondaryDisabled}
                        >
                            {secondaryLabel}
                        </button>
                    )}

                    <button
                        type="button"
                        className="store-modal-primary"
                        onClick={onPrimary}
                        disabled={primaryDisabled}
                    >
                        {primaryLabel}
                    </button>
                </div>
            </section>
        </div>
    );
}

function CoinArt({ variant }) {
    return (
        <div className={`store-coin-art store-coin-art-${variant}`} aria-hidden="true">
            <span className="store-coin coin-back" />
            <span className="store-coin coin-middle" />
            <span className="store-coin coin-front">O</span>
        </div>
    );
}

function AbilityArt({ icon, variant }) {
    return (
        <div className={`store-ability-art store-ability-art-${variant}`} aria-hidden="true">
            <span className="store-ability-ring" />
            <span className="store-ability-icon">{icon}</span>
            <span className="store-ability-spark is-one" />
            <span className="store-ability-spark is-two" />
        </div>
    );
}

function AvatarArt({ icon, variant, imageSrc, name }) {
    return (
        <div className={`store-avatar-art store-avatar-art-${variant}`} aria-hidden="true">
            <span className="store-avatar-frame">
                {imageSrc ? (
                    <img src={imageSrc} alt="" />
                ) : (
                    <span aria-label={name}>{icon}</span>
                )}
            </span>
            <span className="store-avatar-badge" />
        </div>
    );
}

export default Store;
