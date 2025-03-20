import json
import copy
import sys
import random

"""
--- can be searched in code with "E1", "R3", ... ---
Restrictions (MANDATORY):
#  R1) Mandatory subjects are assigned to each group.                          ###DONE
#  R2) No overlapping classes for the same group at the same time.             ###DONE
#  R3) A teacher does not teach two classes at the same time.                  ###DONE
#  R4) A room must be available to the university at the given time.           ###DONE
#R4.1) A room cannot have two classes at the same time.                        ###DONE
#  R5) A course must be taught in a room that supports courses.                ###DONE
#  R6) A professor cannot exceed max teaching hours.                           ###DONE
#  R7) No overlapping courses with seminars for a subject at the same time.    ###DONE?
#  R8) A course can be taught only by an elligible teacher.                    ###DONE
Extra restrictions (POSSIBLE):                                                 #-----#
#  E1) A professor can have a number of maximum daily teaching hours           ###DONE
#  E2) A professor can have unpreferred timeslots                              ###DONE
"""


"""# JSON filenames loaded from the 'eng_data' directory
file_names = ['groups', 'subjects', 'teachers', 'rooms', 'time_slots', 'extra_restrictions']
loaded_data = {}
# loading data from JSON files
for file_name in file_names:
    with open(f'./eng_data/{file_name}.json', 'r') as file:
        read_data = json.load(file)
        loaded_data[file_name] = read_data
"""
loaded_data = json.loads(sys.stdin.read())
# lookup dictionaries for entities accessed by codes(group['code'])
# example: groups[301] gives all info about group 301 (name, language, code)
groups = {group['code']: group for group in loaded_data['groups']}
rooms = {room['code']: room for room in loaded_data['rooms']}
teachers = {teacher['code']: teacher for teacher in loaded_data['teachers']}
subjects = {subject['code']: subject for subject in loaded_data['subjects']}
time_slots = {time['code']: time for time in loaded_data['time_slots']}
extra_restrictions = loaded_data['extra_restrictions']

# builds the list of classes to schedule (courses & seminars)
# iterates through all subjects and adds one course and one seminar after iterating all corresp. groups
# there needs to be a difference between mandatory and optional subjects
# a class is (GROUP_code + SUBJECT_code + class_TYPE(course/seminar))
# group_code == 0 means EVERYONE

shuffle = True
if loaded_data.get('class_list'):
    class_list = loaded_data['class_list']
    shuffle = False

class_list = []
for subject in loaded_data['subjects']:
    if subject['is_optional'] == 0:  # mandatory subject
        for group in loaded_data['groups']:
            group_name = group['name']
            if len(group_name) == 1:  # course group(all subgroups altogether)
                class_list.append({
                    'type': 'course',
                    'subject_code': subject['code'],
                    'group_code': group['code']
                })
            elif group['code'] != 0:  # seminar group (each individual group) --- avoids EVERYONE
                class_list.append({
                    'type': 'seminar',
                    'subject_code': subject['code'],
                    'group_code': group['code']
                })
    else:  # optional subject
        main_groups = [group for group in loaded_data['groups'] if len(group['name']) == 1]
        class_list.append({ 
                'type': 'course',
                'subject_code': subject['code'],
                'group_code': 0 # course is for EVERYONE at the same time
            })
        for group in main_groups: # seminar is for all respective(A or B or ...) subgroups altogether
            class_list.append({
                'type': 'seminar',
                'subject_code': subject['code'],
                'group_code': group['code']
            })

best_timetable = None
if shuffle:
    random.shuffle(class_list)

current_timetable = {}  # current_timetable[teacher_code][time_code] = (group_code, room_code, subject_code, class_type)
teacher_schedule = {}  # which timeslots are occupied by each teacher
group_schedule = {}  # which timeslots are occupied by each group -> detect overlapping classes
for group in groups.values():
    group_schedule[group['code']] = set()
#if group['code'] not in group_schedule:
            #DELETE    group_schedule[group['code']] = set()
room_schedule = {}  # which time slots are occupied by each room
daily_teacher_hours = {}  # daily hours for each teacher per day

def add_to_timetable(teacher_code, time_code, group_code, room_code, subject_code, class_type):
    """
    Attempts to add a class (group_code, room_code, subject_code, class_type)
    to current_timetable[teacher_code][time_code]. 
    True if successful
    1) verifies the group is not already in group_schedule at that time
    2) verifies the room is free at the given timeslot
    3) increments teacher_schedule[teacher_code]
    """
    # initialize teacher in timetable if needed
    if teacher_code not in current_timetable:
        current_timetable[teacher_code] = {}

    # initialize group in schedule if needed
    #if group_code not in group_schedule:
    #DELETE    group_schedule[group_code] = set()

    # if it's a main group (A, B, C...), ensure no sub-group conflicts
    if len(groups[group_code]['name']) == 1:
        for group in groups.values():
            # 
            if str(group['code']).startswith(str(group_code)) and str(group_code) != str(group['code']):
                #if group['code'] not in group_schedule:
                #DELETE    group_schedule[group['code']] = set()
                if time_code in group_schedule[group['code']]:
                    return False ## if subgroup(B1) already has something in schedule, return False for B
        #if 0 not in group_schedule: # EVERYONE
        #DELETE    group_schedule[0] = set()
        if time_code in group_schedule[0]: # if (someone from) EVERYONE is already busy
            return False

    if group_code == 0: # EVERYONE
        for group in groups.values():
            if group['code'] == 0:
                continue # we don't compare it against itself
            #if group['code'] not in group_schedule:
            #DELETE    group_schedule[group['code']] = set()
            if time_code in group_schedule[group['code']]:
                return False # if ANYONE is busy, we can't schedule an EVERYONE course/seminar

    # to add a seminary for a sub-group, its main group must be available at that timeslot 
    main_groups_codes = [group['code'] for group in groups.values() if len(str(group['code'])) == 1]
    if len(groups[group_code]['name']) > 1: # we try to add a subgroup class
        for main_group_code in main_groups_codes:
            if str(group_code).startswith(str(main_group_code)) or main_group_code == 0:
                #if main_group_code not in group_schedule:
                #DELETE    group_schedule[main_group_code] = set()
                if time_code in group_schedule[main_group_code]:   
                    return False   # if main group is busy, we can't have a seminar for it's subgroup

    # checks room schedule (R4.1)
    if room_code not in room_schedule:
        room_schedule[room_code] = set()
    if time_code in room_schedule[room_code]:
        return False

    # handling extra restrictions (E1, E2)
    day = time_slots[time_code]["day"]
    daily_teacher_hours.setdefault(teacher_code, {}).setdefault(day, 0)
    # max_daily_hours becomes TOTAL max_hours if no daily is specified in extra_restrictions
    max_daily_hours = extra_restrictions.get("max_daily_hours", {}).get(str(teacher_code), teachers[teacher_code]["max_hours"])
    if daily_teacher_hours[teacher_code][day] + 1 > max_daily_hours:  # E1
        return False
    unpreferred_slots = extra_restrictions.get("unpreferred_timeslots", {}).get(str(teacher_code), [])
    if time_code in unpreferred_slots:  # E2
        return False

    # assigns class to timetable
    current_timetable[teacher_code][time_code] = (group_code, room_code, subject_code, class_type)
    teacher_schedule[teacher_code] += 1
    group_schedule[group_code].add(time_code)
    room_schedule[room_code].add(time_code)
    daily_teacher_hours[teacher_code][day] += 1
    return True

def remove_from_timetable(teacher_code, time_code):
    """
    Removes an assignment from the timetable and updates schedule structures
    accordingly.
    """
    if teacher_code in current_timetable and time_code in current_timetable[teacher_code]:
        group_code, room_code, _, _ = current_timetable[teacher_code][time_code]
        day = time_slots[time_code]["day"]
        del current_timetable[teacher_code][time_code]
        teacher_schedule[teacher_code] -= 1
        group_schedule[group_code].remove(time_code)
        room_schedule[room_code].remove(time_code)
        daily_teacher_hours[teacher_code][day] -= 1

def backtracking(class_index):
    """
    We TRY to assign each class(group, subject, type) to a
    (TEACHER, TIMESLOT, ROOM) ensuring no overlapping constraints
    """
    global best_timetable
    global extra_restrictions

    # base case: if we've processed all classes, success (R1)
    if class_index == len(class_list):
        best_timetable = copy.deepcopy(current_timetable)
        return 1

    cls = class_list[class_index]
    subject_code = cls['subject_code']
    group_code = cls['group_code']
    class_type = cls['type']

    # we iterate only through teachers which can teach this subject
    """possible_teachers = [
        teacher['code'] for teacher in loaded_data['teachers']
        if subject_code in teacher['subjects_taught']
    ]"""

    # Get max daily hours from extra_restrictions (fallback to teacher's max hours)
    max_daily_hours = {
        teacher_code: extra_restrictions.get("max_daily_hours", {}).get(str(teacher_code), teachers[teacher_code]["max_hours"])
        for teacher_code in teachers
    }

    possible_teachers = [
        teacher_code for teacher_code, teacher_data in teachers.items()
        if subject_code in teacher_data['subjects_taught']
    ]

    # sort teachers with LCV heuristic
    possible_teachers.sort(
        key=lambda t: (
            teachers[t]['can_teach_course'],    # teachers who cannot teach courses first (False < True)
            len(teachers[t]['subjects_taught']), # teachers with fewer subjects first
            -max_daily_hours[t], # teachers with the most free hours first (descending)
            -(teachers[t]['max_hours'] - teacher_schedule.get(t, 0)) 
        )
    )
    #WIP

    # WE TRY to assign each TEACHER in turn
    for teacher_code in possible_teachers:
        # if it's a course, we need to check if teacher is elligible (R8)
        if class_type == 'course' and not teachers[teacher_code]['can_teach_course']:
            continue
        
        # we initialize teacher_schedule if it's not present
        if teacher_code not in teacher_schedule:
            teacher_schedule[teacher_code] = 0

        # check that teacher is below his maximum weekly hours (R6)
        if teacher_schedule[teacher_code] >= teachers[teacher_code]['max_hours']:
            continue
        
        # WE TRY each possible TIMESLOT
        for time in loaded_data['time_slots']:
            time_code = time['code']
            
            # if the group is already busy, skip (R2)
            if time_code in group_schedule.get(group_code, set()):
                continue
            
            # if the teacher is already busy, skip (R3)
            if time_code in current_timetable.get(teacher_code, {}):
                continue

            # WE TRY each possible ROOM
            for room in loaded_data['rooms']:
                room_code = room['code']
                is_course = (class_type == 'course')

                # if the room doesn't allow courses, skip (R5)
                if is_course and not room['course_possible']:
                    continue
                
                # if the room is not available at this timeslot, skip (R4)
                if time_code not in room['possible_times']:
                    continue

                # attempt to assign
                if add_to_timetable(teacher_code, time_code, group_code, room_code, subject_code, class_type):
                    return_value = backtracking(class_index + 1)
                    if return_value == 1:
                        return 1
                    # if not successful, remove assignment
                    remove_from_timetable(teacher_code, time_code)

    return 0

backtracking(0)

print(json.dumps(best_timetable, indent=4))