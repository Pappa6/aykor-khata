import React from "react";

const Step = ({ n, children }) => (
  <li className="ug-step"><span className="ug-n" aria-hidden="true">{n}</span><span>{children}</span></li>
);

export function UserGuide({ ctx }) {
  const { L, go, installEvt } = ctx;
  return (
    <section className="page">
      <h1 className="t2">{L("ব্যবহারের গাইড", "How to use")}</h1>
      <p className="lead">{L("অ্যাপ বসানো ঐচ্ছিক। লিংকে চাপলেই ব্রাউজারে পুরো অ্যাপ চলে। বসালে আইকন থাকে আর ইন্টারনেট ছাড়াও খোলে।", "Installing is optional. The link alone runs the full app in the browser. Installing adds an icon and lets it open without internet.")}</p>

      <div className="paper">
        <h2 className="t3">{L("১. Android ফোনে বসান (Chrome)", "1. Install on Android (Chrome)")}</h2>
        <ol className="ug">
          <Step n="1">{L("লিংকটা Chrome-এ খুলুন। WhatsApp-এ খুললে ওপরের তিন-ফোঁটায় চেপে 'Open in Chrome' বেছে নিন।", "Open the link in Chrome. If it opened inside WhatsApp, tap the three dots and choose 'Open in Chrome'.")}</Step>
          <Step n="2">{L("প্রথম পাতার নিচে 'ফোনে অ্যাপ হিসেবে বসান' বোতামে চাপুন। বোতাম না দেখলে Chrome-এর ডানদিকের তিন-ফোঁটা মেনুতে 'Add to Home screen' বা 'Install app' চাপুন।", "Tap 'Install on this phone' at the bottom of the first page. If you do not see it, open Chrome's three-dot menu and tap 'Add to Home screen' or 'Install app'.")}</Step>
          <Step n="3">{L("'Install' বা 'Add' চাপুন। হোম স্ক্রিনে 'আয়কর খাতা' আইকন আসবে।", "Tap 'Install' or 'Add'. The 'আয়কর খাতা' icon appears on your home screen.")}</Step>
        </ol>
        {installEvt && <button className="btn" onClick={() => installEvt.prompt()}>{L("এখনই বসান", "Install now")}</button>}
      </div>

      <div className="paper">
        <h2 className="t3">{L("২. iPhone-এ বসান (Safari)", "2. Install on iPhone (Safari)")}</h2>
        <ol className="ug">
          <Step n="1">{L("লিংকটা Safari-তে খুলুন। iPhone-এ Chrome দিয়ে বসানো যায় না।", "Open the link in Safari. On iPhone it cannot be installed from Chrome.")}</Step>
          <Step n="2">{L("নিচের Share চিহ্নে (বর্গ আর ওপরে তীর) চাপুন।", "Tap the Share icon (a square with an arrow) at the bottom.")}</Step>
          <Step n="3">{L("'Add to Home Screen' বেছে 'Add' চাপুন।", "Choose 'Add to Home Screen', then tap 'Add'.")}</Step>
        </ol>
      </div>

      <div className="paper">
        <h2 className="t3">{L("৩. ল্যাপটপে বসান (Chrome বা Edge)", "3. Install on a laptop (Chrome or Edge)")}</h2>
        <ol className="ug">
          <Step n="1">{L("লিংক খুলুন।", "Open the link.")}</Step>
          <Step n="2">{L("ঠিকানার ঘরের ডানদিকে 'Install' আইকনে চাপুন, তারপর 'Install'।", "Click the 'Install' icon at the right end of the address bar, then 'Install'.")}</Step>
        </ol>
      </div>

      <div className="paper">
        <h2 className="t3">{L("৪. ইন্টারনেট ছাড়া চলছে কিনা দেখুন", "4. Check that it works offline")}</h2>
        <ol className="ug">
          <Step n="1">{L("ইন্টারনেট চালু থাকা অবস্থায় অ্যাপ একবার খুলুন, মিনিটখানেক রাখুন। এতে সব ফাইল ফোনে জমে যায়।", "With internet on, open the app once and leave it for a minute. This saves every file on your device.")}</Step>
          <Step n="2">{L("এবার ফোনে এয়ারপ্লেন মোড চালু করে আইকন থেকে খুলুন। অ্যাপ ঠিকঠাক খুললে সব ঠিক আছে।", "Now switch on airplane mode and open it from the icon. If it opens, all is well.")}</Step>
          <Step n="3">{L("ইন্টারনেট লাগবে শুধু আয়কর পোর্টালে ফাইল করার সময়, আর কর-নিয়ম বদলালে নতুন নিয়ম আনতে।", "Internet is needed only to file on the income-tax portal, and to fetch updated tax rules when they change.")}</Step>
        </ol>
      </div>

      <div className="paper">
        <h2 className="t3">{L("৫. কীভাবে রিটার্নের হিসাব করবেন", "5. How to work out your return")}</h2>
        <ol className="ug">
          <Step n="1">{L("হোমে বছর বেছে 'শুরু করুন' চাপুন। PAN আর জন্মতারিখ দিন।", "Pick the year on Home and tap 'Start'. Enter your PAN and date of birth.")}</Step>
          <Step n="2">{L("কাগজ দিন: AIS/TIS, Form 16/16A, ব্রোকারের capital gains স্টেটমেন্ট। PDF, CSV বা Excel চলে। পাসওয়ার্ড দেওয়া PDF-ও খোলে। হাতে টাইপ করলেও একই ফল।", "Give your papers: AIS/TIS, Form 16/16A, broker capital-gains statement. PDF, CSV or Excel all work, including password-protected PDFs. Typing by hand gives the same result.")}</Step>
          <Step n="3">{L("কয়েকটা সহজ প্রশ্নের উত্তর দিন। অ্যাপ নিজেই সঠিক ITR ফর্ম বেছে নেয়।", "Answer a few easy questions. The app picks the right ITR form itself.")}</Step>
          <Step n="4">{L("আয়ের পাতায় যা মিসিং বা মেলেনি, অ্যাপ লাল বা হলুদ করে দেখায়। ঠিক করুন।", "On the income page the app flags anything missing or mismatched. Fix it.")}</Step>
          <Step n="5">{L("ফল দেখুন: মোট আয়, করযোগ্য আয়, কর, কত দিতে হবে বা কত ফেরত পাবেন।", "See the result: total income, taxable income, tax, and what you pay or get back.")}</Step>
          <Step n="6">{L("'পোর্টালে ফাইল করার গাইড' খুলে পাশাপাশি আয়কর পোর্টাল খুলুন। গাইড বলে দেবে কোন পাতার কোন ঘরে কত অঙ্ক বসবে। অ্যাপ নিজে লগইন বা সাবমিট করে না। শেষে e-Verify আপনি করবেন, ফাইলের পর ৩০ দিনের মধ্যে।", "Open 'Portal filing guide' and keep the income-tax portal beside it. The guide tells you which box gets which number. The app never logs in or submits for you. You e-Verify yourself within 30 days of filing.")}</Step>
        </ol>
      </div>

      <div className="paper">
        <h2 className="t3">{L("মনে রাখবেন", "Please remember")}</h2>
        <ul>
          <li>{L("আপনার ফাইল আর তথ্য ফোনের বাইরে যায় না। কোনো লগইন বা সার্ভার নেই।", "Your files and data never leave your device. No login, no server.")}</li>
          <li>{L("এটা হিসাবের সহায়ক। ফাইল করার আগে নিজে মিলিয়ে নিন। জটিল কেসে (বিদেশি সম্পদ, ESOP, F&O, বড় ব্যবসা) CA-র সঙ্গে দেখান।", "This is a calculation aid. Check before you file. For complex cases (foreign assets, ESOP, F&O, large businesses) consult a CA.")}</li>
          <li>{L("ব্যাংক ঋণের জন্য পোর্টালের acknowledgement আর 26AS/AIS লাগে। এই অ্যাপের PDF শুধু নিজের মিলিয়ে দেখার জন্য।", "For bank loans you need the portal acknowledgement and 26AS/AIS. This app's PDF is for your own check only.")}</li>
        </ul>
      </div>
      <div className="row-btns"><button className="btn ghost" onClick={() => go("home")}>{L("হোম", "Home")}</button></div>
    </section>
  );
}
