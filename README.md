Timetable Builder
=================

> **Bachelor’s Thesis – Faculty of Computer Science, “Alexandru Ioan Cuza” University of Iași (July 2025)**

TimetableBuilder is a web‑based system that **automatically generates university timetables** while letting teachers refine the result with natural‑language requests such as “no seminars on Friday after 2pm”.  
It was built as my undergraduate capstone project and showcases my ability to combine **constraint‑solving AI, modern web back‑end engineering, and friendly UX**.

--- 

## Demo (video)
[Google Drive Upload](https://drive.google.com/file/d/1Z0ixsoVTc8m_KhHaFAaUnoUuR2TfI_-r/view?usp=sharing)

---

## Key Highlights  
* **Two CSP solvers**  
  * *Backtracking + Backjumping & LCV heuristics* – fast baseline that keeps previous schedules almost intact.  
  * *Random‑Restart Hill‑Climbing* – explores a larger search space, guided by a cost function, until a user‑configurable timeout expires.  
* **Live NL constraints** – extra rules are injected at runtime by parsing staff prompts with the OpenAI API.  
* **Micro‑service architecture** in Node.js:  
  * **AuthService** – cookie‑based sessions & role management.  
  * **TimetableService** – CSP engine + prompt parsing.  
  * **FrontendService** – lightweight static UI (vanilla JS, HTML, CSS).  
* **MySQL** data layer with separate schemas for users, academic resources, and generated schedules.  
* **Responsive client UI** with dark / light themes, teacher & group filters, and clickable cards for overlapping classes.  
* **Security first** – HTTPS everywhere, CORS whitelist, HSTS, AES‑encrypted, HttpOnly, SameSite=Lax cookies.

---

## TechStack
| Layer             | Tech                                                                                                                                 |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| Language          | JavaScript(79%), HTML/CSS(17%), Python(4%)                                             |
| Back‑end          | Node.js REST OpenAI SDK                                                       |
| Front‑end         | Vanilla JS and CSS                                              |
| Data              | MySQL                                                                  |
| Other             | Python`scrapperUAIC.py` for scraping real faculty data                                       |

---

## RepositoryMap
```
├── microservices/
│   ├── auth‑service/            # login, signup, cookie validation
│   ├── timetable‑service/       # CSP solvers + OpenAI promptParse
│   └── frontend‑service/        # static UI & REST client
├── uaic_data/                   # MySQL dumps & seed files
├── initDatabases.js             # one‑shot DB initialisation helper
└── scrapperUAIC.py              # fetches official curriculum
```

---


## License
MIT – see `LICENSE` for details.
