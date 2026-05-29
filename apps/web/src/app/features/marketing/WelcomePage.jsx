<button
  type="button"
  onClick={() => (typeof onStartFreeTrial === "function" ? onStartFreeTrial() : onOpenAuth("register"))}
  style={{
    padding: "12px 18px",
    borderRadius: 10,
    border: "none",
    background: "#16a34a",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  }}
>
  สมัครใช้ฟรี 14 วัน
</button>