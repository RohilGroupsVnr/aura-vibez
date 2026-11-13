const CREATE_URL = "https://asia-south1-aura-8a9b5.cloudfunctions.net/createRazorpayOrder";
const VERIFY_URL = "https://asia-south1-aura-8a9b5.cloudfunctions.net/verifyRazorpayPayment";

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Razorpay script load aagala"));
    document.head.appendChild(s);
  });
}

// items: [{ id, qty, size, color }]
// customer: { name, phone, email }
// onSuccess(paymentInfo), onFail(message)
window.auraPayOnline = async function ({ items, customer = {}, onSuccess, onFail }) {
  try {
    await loadRazorpayScript();

    const r = await fetch(CREATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, customer }),
    });
    const order = await r.json();
    if (!order.ok) throw new Error(order.error || "Order create aagala");

    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: "INR",
      name: "AURA",
      description: "Order payment",
      order_id: order.rzpOrderId,
      prefill: {
        name: customer.name || "",
        contact: customer.phone || "",
        email: customer.email || "",
      },
      theme: { color: "#7a1f3d" },
      handler: async function (resp) {
        try {
          const v = await fetch(VERIFY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(resp),
          });
          const vr = await v.json();
          if (vr.ok) onSuccess && onSuccess(resp);
          else onFail && onFail("Payment verify aagala");
        } catch (e) {
          onFail && onFail(e.message);
        }
      },
      modal: { ondismiss: () => onFail && onFail("Payment cancel pannitteenga") },
    });

    rzp.on("payment.failed", (e) => onFail && onFail(e.error.description));
    rzp.open();
  } catch (e) {
    onFail && onFail(e.message);
  }
};