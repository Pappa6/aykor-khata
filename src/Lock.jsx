import React, { useEffect, useRef, useState } from "react";
import { hashPin, loadPin } from "./store.js";
import { useL } from "./ui.jsx";

export function Lock({ onUnlock }) {
  const { L } = useL();
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [tries, setTries] = useState(0);
  const [wait, setWait] = useState(false);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const submit = async (e) => {
    e.preventDefault();
    if (wait) return;
    const stored = loadPin();
    if (!stored) return onUnlock();
    const h = await hashPin(pin, stored.salt);
    if (h === stored.hash) { setPin(""); return onUnlock(); }
    const t = tries + 1;
    setTries(t);
    setPin("");
    setMsg(L("PIN মেলেনি। আবার চেষ্টা করুন।", "Wrong PIN. Try again."));
    if (t >= 3) { setWait(true); setTimeout(() => setWait(false), Math.min(30000, 2000 * t)); }
  };
  return (
    <div className="lock" role="dialog" aria-modal="true" aria-labelledby="lock-title">
      <form onSubmit={submit} className="lockbox">
        <div className="mark big" aria-hidden="true">₹</div>
        <h1 id="lock-title" className="t2">{L("আয়কর খাতা", "Aykor Khata")}</h1>
        <p className="lead">{L("PIN দিয়ে খুলুন", "Enter your PIN")}</p>
        <label className="sr" htmlFor="pin">PIN</label>
        <input id="pin" ref={ref} className="input pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} aria-describedby="pin-msg" />
        <p id="pin-msg" role="alert" className="msg err">{wait ? L("কয়েক সেকেন্ড অপেক্ষা করুন।", "Wait a few seconds.") : msg}</p>
        <button className="btn" type="submit" disabled={wait || pin.length < 4}>{L("খুলুন", "Unlock")}</button>
        <p className="lead small">{L("PIN ভুলে গেলে ব্রাউজারের সাইট-ডেটা মুছতে হবে। খাতার কপি আগে নামানো থাকলে ফেরত আনা যায়।", "If you forget the PIN, the browser's site data must be cleared. A saved backup lets you restore the ledger.")}</p>
      </form>
    </div>
  );
}

export function PinSettings({ ctx }) {
  const { L, pinSet, setPinSet } = ctx;
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [cur, setCur] = useState("");
  const [msg, setMsg] = useState("");
  const store = React.useRef(null);
  const ok = (t) => setMsg({ ok: true, t });
  const bad = (t) => setMsg({ ok: false, t });
  const doSet = async () => {
    const { savePin, newSalt } = await import("./store.js");
    if (a.length < 4) return bad(L("PIN কমপক্ষে ৪ সংখ্যার হবে।", "The PIN needs at least 4 digits."));
    if (a !== b) return bad(L("দুটো PIN মেলেনি।", "The two PINs do not match."));
    if (pinSet) {
      const s = loadPin();
      if ((await hashPin(cur, s.salt)) !== s.hash) return bad(L("বর্তমান PIN ভুল।", "The current PIN is wrong."));
    }
    const salt = newSalt();
    savePin({ salt, hash: await hashPin(a, salt) });
    setPinSet(true); setA(""); setB(""); setCur("");
    ok(L("PIN বসানো হয়েছে। ৫ মিনিট না ব্যবহার করলে বা অ্যাপ বন্ধ করে খুললে লক হবে।", "PIN set. The app locks after 5 idle minutes or when reopened."));
  };
  const doRemove = async () => {
    const { savePin } = await import("./store.js");
    const s = loadPin();
    if (!s || (await hashPin(cur, s.salt)) !== s.hash) return bad(L("বর্তমান PIN ভুল।", "The current PIN is wrong."));
    savePin(null); setPinSet(false); setCur(""); setA(""); setB("");
    ok(L("PIN সরানো হয়েছে।", "PIN removed."));
  };
  const digits = (set) => (e) => set(e.target.value.replace(/\D/g, ""));
  const F = ({ id, label, val, set }) => (
    <label className="field" htmlFor={id}><span>{label}</span>
      <input id={id} className="input" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={val} onChange={digits(set)} />
    </label>
  );
  return (
    <div>
      <h2 className="t3">{L("PIN লক (ঐচ্ছিক)", "PIN lock (optional)")}</h2>
      <p className="lead">{L("এটা শুধু পর্দা আড়াল করে, অন্য কেউ ফোন হাতে নিলে যেন সহজে না দেখে। তথ্য এনক্রিপ্ট করা নয়। ফোনের নিজের স্ক্রিন লকও রাখুন।", "This only hides the screen from a casual glance. It does not encrypt data. Keep the phone's own screen lock too.")}</p>
      {pinSet && <F id="pin-cur" label={L("বর্তমান PIN", "Current PIN")} val={cur} set={setCur} />}
      <F id="pin-a" label={pinSet ? L("নতুন PIN (৪ থেকে ৬ সংখ্যা)", "New PIN (4 to 6 digits)") : L("PIN (৪ থেকে ৬ সংখ্যা)", "PIN (4 to 6 digits)")} val={a} set={setA} />
      <F id="pin-b" label={L("আবার PIN", "PIN again")} val={b} set={setB} />
      <div className="row-btns">
        <button className="btn" onClick={doSet}>{pinSet ? L("PIN বদলান", "Change PIN") : L("PIN বসান", "Set PIN")}</button>
        {pinSet && <button className="btn ghost" onClick={doRemove}>{L("PIN সরান", "Remove PIN")}</button>}
      </div>
      <div role="status" aria-live="polite">{msg && <p className={"msg " + (msg.ok ? "ok" : "err")}>{msg.t}</p>}</div>
    </div>
  );
}
