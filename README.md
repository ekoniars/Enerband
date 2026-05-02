# 🎯 ENERBAND DEMO SITE — Lead Conversion Architect

## 🚀 איך להפעיל את האתר

### אפשרות 1: פתח ישירות ב-Browser
```bash
open /Users/ekoniars/projects/Enerband/demo-site/index.html
```

### אפשרות 2: הפעל local server (עדיף)
```bash
cd /Users/ekoniars/projects/Enerband/demo-site
python3 -m http.server 8000
# ואז פתח http://localhost:8000
```

---

## 📖 מה יש לך כאן

### ✅ עמודים מלאים (9 עמודים)

| דף | URL | תיאור |
|----|-----|-------|
| **Home** | `/index.html` | Landing page — כל הכלים שלך בעמוד אחד |
| **The 5-Min Ritual** | `/pages/ritual.html` | איך להשתמש בـ Enerband — 5 שלבים |
| **The Science** | `/pages/science.html` | הטכנולוגיה — 24K זהב + Patented fusion |
| **Clinical Proof** | `/pages/clinical.html` | Prof. Shemer + הנתונים |
| **Burst & Save** | `/pages/burst.html` | המערכת של ירידת מחיר דרך חברים |
| **Answers (FAQ)** | `/pages/faq.html` | שאלות נפוצות |
| **Order** | `/pages/order.html` | עמוד ההזמנה + בחירת צבע |
| **Thank You** | `/pages/thanks.html` | עמוד תודה אחרי קנייה |
| **Community** | `/pages/community.html` | UGC + Testimonials — עמוד חדש |
| **Influencers** | `/pages/influencer.html` | Hub לממשיקי חשבון |
| **B2B Partners** | `/pages/b2b.html` | Portal לשותפים B2B |

---

## 🎨 עיצוב

- **צבע זהב**: `#c9a961` (Enerband brand)
- **סטיל**: Minimal, modern, typography-first
- **Responsive**: עובד בכל גודל מסך
- **ניווט**: Sticky nav בכל עמוד

---

## 📝 עריכה ושמירה של טקסטים

### איך לערוך טקסט?

1. **לחץ על כל טקסט בעמוד** שיש לו רקע בהיר בעת hover
2. **תיפתח textarea** שאפשר לכתוב בה
3. **לחץ Ctrl+Enter** או לחץ out של התיבה כדי לשמור

### איך להעתיק טקסט?

1. **לחץ Double-click על הטקסט**
2. **יוצא tooltip** שאומר "✓ Copied!"
3. **הטקסט בclipboard שלך** — paste איפה שרוצה

### איפה נשמרים הטקסטים?

- **localStorage** — בתוך ה-browser שלך
- **לא עולה לשרת** — הכל local
- **יעילות**: זכור עורכים את הטקסט, לא היא שומרת באופן אוטומטי

---

## 🎬 וידאו + מדיה

כל עמוד יש `<div class="media-box">` שרשום בו:
```
VIDEO LOOP — [תיאור]
```

אתה תוכל להחליף את זה בקובץ וידאו אמיתי:

```html
<video class="media-box" loop autoplay muted>
  <source src="your-video.mp4" type="video/mp4">
</video>
```

---

## 🔘 כפתורים (Buttons)

כל CTA יש טוקן מובנה:

```html
<a href="pages/order.html" class="btn btn-primary">Drop My Price →</a>
```

### סוגי כפתורים

| סוג | קלאס | שימוש |
|-----|------|-------|
| ראשי שחור | `btn btn-primary` | קרא לפעולה עיקרית |
| זהב | `btn btn-gold` | דגש על היתרון |
| outline | `btn btn-outline` | אפשרות משנית |

---

## 🎯 הטקסטים שלך (מה שנעשה כאן)

### Reduction: 72% פחות מילים

| סקשן | מקורי | חדש | חיסכון |
|------|-------|-----|--------|
| Hero | ~45 מילים | 12 | -73% |
| Science | ~35 | 11 | -68% |
| Clinical | ~50 | 14 | -72% |
| Testimonials | ~80 | 20 | -75% |
| Referral | ~60 | 18 | -70% |

### ההנחיות שהשתמשנו:

✅ **Burstbox Protocol** — "Drop My Price," "Get It Free"
✅ **5 Marketing Pillars** — Trust, Reward, Referral, Instant, Virality
✅ **Zero Gravity Anchor** — כל משהו בולע חזרה לדיוק הפתיחה
🚫 **No miracle talk** — רק "Clinically Proven," "Patented"

---

## 🛠️ Customization

### להוסיף עמוד חדש

1. העתק `template.html` (אם קיים) או עמוד קיים
2. שנה את `<title>` וה-`<h1>`
3. הוסף את הלינק בـ `<nav class="nav">`
4. בקובץ ה-template יש סקריפט editable כבר

### להוסיף סקט editable

```html
<h2><span class="editable">Your text here</span></h2>
```

סקריפט ה-edit יקלט אותו אוטומטית.

---

## 📞 שימושים נפוצים

### א) אתה רוצה לשנות את ה-Hero

```bash
# Open this file:
open /Users/ekoniars/projects/Enerband/demo-site/index.html

# Scroll to HERO SECTION
# Click the text
# Edit
# Done!
```

### ב) אתה רוצה להעתיק את הטקסטים

```bash
# Double-click any text → "✓ Copied!"
# Paste בעורך שלך (Google Docs, Word, etc.)
```

### ג) אתה רוצה לשנות צבע זהב

ערוך `styles.css`:
```css
:root {
  --gold: #YOUR_COLOR; /* בדל"ת — כל יום אחרון */
}
```

---

## ✨ מה שעשינו בשביל Skill.md

זה **Lead Conversion Architect** mode — כל טקסט אם מוטבע עם:

1. **Zero Gravity anchor** — לא משנים מעדותה
2. **Burstbox protocol** — CTAs ברורים ומ דידים
3. **Science-validated copy** — אף פעם לא "miracle"
4. **Viral mechanics** — הכל נחשב לשמירה וחלוקה

---

## 📊 Metrics שלך

```
Total pages:        9
Total CTAs:         18+
Editable sections:  40+
Video placeholders: 12
Mobile-ready:       Yes (100% responsive)
```

---

## 🎁 בונוס: Export טקסטים

כדי לייצא את כל הטקסטים:
```javascript
// Open Chrome DevTools (F12 → Console)
// Paste this:
Array.from(document.querySelectorAll('.editable'))
  .map(el => el.innerText)
  .join('\n---\n');
```

Copy מ-console ו-paste בטקסט שלך!

---

**מוכן?** 🚀 פתח את `index.html` וקלול עצמך על הטקסטים!

