import re
import json
from collections import OrderedDict

import requests
from bs4 import BeautifulSoup

# Organize URLs by year and section
urls_by_year = {
    1: [
        "https://web.archive.org/web/20241107034048/https://edu.info.uaic.ro/orar/participanti/orar_I1A.html",
        "https://web.archive.org/web/20241015194743/https://edu.info.uaic.ro/orar/participanti/orar_I1B.html",
        "https://web.archive.org/web/20241015192439/https://edu.info.uaic.ro/orar/participanti/orar_I1E.html",
    ],
    2: [
        "https://web.archive.org/web/20241015185849/https://edu.info.uaic.ro/orar/participanti/orar_I2A.html",
        "https://web.archive.org/web/20241202113450/https://edu.info.uaic.ro/orar/participanti/orar_I2B.html",
        "https://web.archive.org/web/20241107034026/https://edu.info.uaic.ro/orar/participanti/orar_I2E.html",
    ],
    3: [
        "https://web.archive.org/web/20241107032419/https://edu.info.uaic.ro/orar/participanti/orar_I3A.html",
        "https://web.archive.org/web/20241202112658/https://edu.info.uaic.ro/orar/participanti/orar_I3B.html",
        "https://web.archive.org/web/20241202105950/https://edu.info.uaic.ro/orar/participanti/orar_I3E.html",
    ],
}

subject_id = 1
teacher_id = 1

subjects_by_key = OrderedDict()  # (name, year) → {...}
teachers_by_name = OrderedDict()  # name → {...}

for year, urls in urls_by_year.items():
    print(f"\nProcessing year {year}...\n")

    for url_index, url in enumerate(urls):
        print(f"  Fetching: {url}")
        html = requests.get(url).text
        soup = BeautifulSoup(html, "html.parser")

        is_english_page = url.endswith("E.html")

        for tr in soup.select("tr"):
            row_text = tr.get_text(" ", strip=True)

            if any(keyword in row_text for keyword in ["Facultativ", "Educație fizică", "Impare", "Pare"]):
                continue

            # English pages (E) - only parse teachers
            if is_english_page:
                teachers_cell = tr.select_one("td:nth-of-type(5)")
                if not teachers_cell:
                    continue

                teachers_a = teachers_cell.select('a[href*="/participanti/"]')
                if not teachers_a:
                    continue

                tip_cell = tr.select_one("td:nth-of-type(4)")
                is_course = tip_cell and "Curs" in tip_cell.get_text()

                subj_a = tr.select_one('a[href*="/discipline/"]')
                subj_name = subj_a.text.strip() if subj_a else "(unknown subject)"

                for a in teachers_a:
                    t_name = " ".join(a.text.split())

                    if is_course and t_name in teachers_by_name and not teachers_by_name[t_name]["can_teach_course"]:
                        print(f"    ! {t_name} teaches a course in year {year}E but has can_teach_course = false")

                    if t_name not in teachers_by_name:
                        print(f"    > Teacher only found on year {year}E page: {t_name} - taught subject: {subj_name}")
                        teachers_by_name[t_name] = {
                            "code": teacher_id,
                            "name": t_name,
                            "subjects_taught": set(),
                            "max_hours": 0,
                            "can_teach_course": False,
                        }
                        teacher_id += 1
                continue

            # romanian pages - full parsing
            subj_a = tr.select_one('a[href*="/discipline/"]')
            if not subj_a:
                continue
            subj_name = subj_a.text.strip()

            if year == 2 and subj_name == "Capitole speciale de sisteme de operare":
                continue # problem in the UAIC dataset

            is_opt = 1 if re.search(r">\s*(\d+)\s*<", str(tr)) else 0

            key = (subj_name, year)
            if key not in subjects_by_key:
                subjects_by_key[key] = {
                    "code": subject_id,
                    "name": subj_name,
                    "is_optional": is_opt,
                    "year": year,
                }
                subject_id += 1
            else:
                subjects_by_key[key]["is_optional"] |= is_opt

            subj_code = subjects_by_key[key]["code"]

            teachers_cell = tr.select_one("td:nth-of-type(5)")
            if not teachers_cell:
                continue

            teachers_a = teachers_cell.select('a[href*="/participanti/"]')
            tip_cell = tr.select_one("td:nth-of-type(4)")
            is_course = tip_cell and "Curs" in tip_cell.get_text()

            for a in teachers_a:
                t_name = " ".join(a.text.split())

                if t_name not in teachers_by_name:
                    teachers_by_name[t_name] = {
                        "code": teacher_id,
                        "name": t_name,
                        "subjects_taught": set(),
                        "max_hours": 0,
                        "can_teach_course": False,
                    }
                    teacher_id += 1

                teacher = teachers_by_name[t_name]
                if subj_code not in teacher["subjects_taught"]:
                    teacher["subjects_taught"].add(subj_code)
                    teacher["max_hours"] += 4
                if is_course:
                    teacher["can_teach_course"] = True

subjects = list(subjects_by_key.values())
teachers = [
    {
        "code": t["code"],
        "name": t["name"],
        "subjects_taught": sorted(t["subjects_taught"]),
        "max_hours": t["max_hours"],
        "can_teach_course": t["can_teach_course"],
    }
    for t in teachers_by_name.values()
]

with open("subjects.json", "w", encoding="utf-8") as f:
    json.dump(subjects, f, ensure_ascii=False, indent=4)

with open("teachers.json", "w", encoding="utf-8") as f:
    json.dump(teachers, f, ensure_ascii=False, indent=4)

print("\n subjects.json and teachers.json created")
