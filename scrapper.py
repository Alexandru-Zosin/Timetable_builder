import re
import json
from collections import OrderedDict

import requests
from bs4 import BeautifulSoup

urls = [
    "https://web.archive.org/web/20241107034048/https://edu.info.uaic.ro/orar/participanti/orar_I1A.html",
    "https://web.archive.org/web/20241015194743/https://edu.info.uaic.ro/orar/participanti/orar_I1B.html",
    "https://web.archive.org/web/20241015192439/https://edu.info.uaic.ro/orar/participanti/orar_I1E.html",
]

subject_id = 1
teacher_id = 1

subjects_by_name = OrderedDict()   # rom‑name → {code, ...}
teachers_by_name = OrderedDict()   # full‑name → {...}

for url_index, url in enumerate(urls):
    html = requests.get(url).text
    soup = BeautifulSoup(html, "html.parser")

    for tr in soup.select("tr"):
        row_text = tr.get_text(" ", strip=True)

        # skip facultative rows
        if "Facultativ" in row_text:
            continue

        # English page: only scan teachers and skip the rest
        if url_index == 2:
            teachers_cell = tr.select_one("td:nth-of-type(5)")
            if not teachers_cell:
                continue

            teachers_a = teachers_cell.select('a[href*="/participanti/"]')
            if not teachers_a:
                continue

            tip_cell = tr.select_one("td:nth-of-type(4)")
            is_course = tip_cell and "Curs" in tip_cell.get_text()

            # Find the subject this row refers to (just for print)
            subj_a = tr.select_one('a[href*="/discipline/"]')
            subj_name = subj_a.text.strip() if subj_a else "(unknown subject)"

            for a in teachers_a:
                t_name = " ".join(a.text.split())

                # Warn if existing teacher should be marked as course teacher
                if is_course and t_name in teachers_by_name and not teachers_by_name[t_name]["can_teach_course"]:
                    print(f"{t_name} teaches a course in I3E but has can_teach_course = false")

                # Add stub if new, and print what they were teaching
                if t_name not in teachers_by_name:
                    print(f"Teacher only found on I3E page: {t_name} - taught subject: {subj_name}")
                    teachers_by_name[t_name] = {
                        "code": teacher_id,
                        "name": t_name,
                        "subjects_taught": set(),
                        "max_hours": 0,
                        "can_teach_course": False,
                    }
                    teacher_id += 1
            continue  # Skip further I3E row processing

        # Romanian pages: full processing
        subj_a = tr.select_one('a[href*="/discipline/"]')
        if not subj_a:
            continue
        subj_name = subj_a.text.strip()

        is_opt = 1 if re.search(r">\s*(\d+)\s*<", str(tr)) else 0

        if subj_name not in subjects_by_name:
            subjects_by_name[subj_name] = {
                "code": subject_id,
                "name": subj_name,
                "is_optional": is_opt,
            }
            subject_id += 1
        else:
            subjects_by_name[subj_name]["is_optional"] |= is_opt

        subj_code = subjects_by_name[subj_name]["code"]

        teachers_cell = tr.select_one("td:nth-of-type(5)")
        if not teachers_cell:
            continue
        teachers_a = teachers_cell.select('a[href*="/participanti/"]')

        is_course = "Curs" in tr.select_one("td:nth-of-type(4)").get_text()

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

            t = teachers_by_name[t_name]
            if subj_code not in t["subjects_taught"]:
                t["subjects_taught"].add(subj_code)
                t["max_hours"] += 4

            if is_course:
                t["can_teach_course"] = True


subjects = list(subjects_by_name.values())
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

# ---------- write / print ---------------------------------------------------

with open("subjects.json", "w", encoding="utf-8") as f:
    json.dump(subjects, f, ensure_ascii=False, indent=4)

with open("teachers.json", "w", encoding="utf-8") as f:
    json.dump(teachers, f, ensure_ascii=False, indent=4)

print("subjects.json and teachers.json created")