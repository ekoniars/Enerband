# 🚀 GitHub Pages Setup — Enerband

## 📋 הוראות להנחת האתר בחינם ל-נצח

### שלב 1: יצירת Repository ב-GitHub

1. **עבור ל-GitHub**: https://github.com/new
2. **בחר**:
   - Repository name: **Enerband**
   - Description: "Enerband - Zero Gravity Skin Coach. Dynamic influencer marketing platform"
   - Public (חייב להיות public ל-GitHub Pages)
   - **Initialize repository**: NO (כבר יש לנו Git locally)

3. **לחץ "Create repository"**

---

### שלב 2: הוסף Remote ו-Push

```bash
# בספריית הפרויקט:
cd /Users/ekoniars/projects/Enerband/demo-site

# הוסף את GitHub כ-remote:
git remote add origin https://github.com/ekoniars/Enerband.git

# Push לראשונה:
git branch -M main
git push -u origin main
```

**הערה**: אם יש לך SSH key, אתה יכול להשתמש:
```bash
git remote add origin git@github.com:ekoniars/Enerband.git
```

---

### שלב 3: Enable GitHub Pages

1. **עבור ל-Repository Settings**: https://github.com/ekoniars/Enerband/settings/pages
2. **תחת "Source"**, בחר:
   - Branch: **main**
   - Folder: **/(root)**
3. **לחץ "Save"**

---

### שלב 4: תקבל את ה-Link שלך!

תוך **1-2 דקות**, האתר יהיה live ב:

```
https://ekoniars.github.io/Enerband/
```

---

## 📈 איך זה עובד

```
You push to GitHub
        ↓
GitHub Pages auto-builds
        ↓
Your site is live (HTTPS)
        ↓
Every push = instant update
```

---

## 🔄 עדכונים מאיתי (Claude)

כשתגיד לי "שנה את טקסט עמוד X":

```bash
# אני:
1. עורך את הקובץ
2. git add -A
3. git commit -m "Update: ..."
4. git push origin main

# GitHub Pages:
- Detects the push
- Rebuilds automatically
- Your site updates instantly
```

---

## 🎯 Custom Domain (Optional)

אם יש לך domain משלך (enerband.com):

1. **בספריית הrepo**, יצור קובץ `CNAME`:
   ```
   enerband.com
   ```

2. **Push**:
   ```bash
   git add CNAME
   git commit -m "Add custom domain"
   git push origin main
   ```

3. **ב-GitHub Settings → Pages**, תראה:
   ```
   Custom domain: enerband.com
   ```

4. **אצל ה-Domain Provider שלך** (GoDaddy, Namecheap, etc.):
   - עדכן את ה-DNS records:
     ```
     A record: 185.199.108.153
     A record: 185.199.109.153
     A record: 185.199.110.153
     A record: 185.199.111.153
     ```
   - או (אם יש CNAME):
     ```
     CNAME: ekoniars.github.io
     ```

---

## 💡 טיפים

### Local Testing
```bash
# בספריית הפרויקט:
python3 -m http.server 8000

# תפתח: http://localhost:8000
```

### View All Updates
```bash
git log --oneline
```

### Rollback אם צריך
```bash
git revert <commit-id>
git push origin main
```

---

## ✅ Checklist

- [ ] יצרת Enerband repo ב-GitHub
- [ ] Enabled GitHub Pages (settings/pages)
- [ ] Pushed את ה-code (git push origin main)
- [ ] אתר חי ב-ekoniars.github.io/Enerband
- [ ] תשלחת לי message שכל עדכויות דורך Claude עכשיו

---

## 🎉 בוצע!

אתה עכשיו בעלים של:
- ✅ 11 עמודים
- ✅ Editable copy
- ✅ Responsive design
- ✅ Free hosting (נצח)
- ✅ Free updates (מאיתי)
- ✅ HTTPS security
- ✅ Global CDN

**כל זה בחינם.** 🚀

---

**שאלות? כתוב לי!**

