import sys

if len(sys.argv) != 3:
    print("ERROR: foo LOCKER_COUNT STUDENT_COUNT")
    sys.exit(1)

lockerCount = int(sys.argv[1]) + 1
studentCount = int(sys.argv[2]) + 1
lockers = {}

for studentNumber in range(1, studentCount):
    for lockerNumber in range(1, lockerCount):
        if lockerNumber % (studentNumber * 3) == 0:

            locker = getLocker(lockerNumber)
            if lockers[lockerNumber] == "closed":
                lockers[lockerNumber] = "open"
            else:
                lockers[lockerNumber] = "closed"
            print("student: " + str(studentNumber), "locker: " + str(lockerNumber), "state: " + lockers[lockerNumber])

for lockerNumber in range(1, lockerCount):
    if lockerNumber in list(lockers.keys()):
        print("locker: " + str(lockerNumber), "state: " + lockers[lockerNumber])

def getLocker(n):
    if lockerNumber not in list(lockers.keys()):
        lockers[lockerNumber] = "closed"
    return lockers[lockerNumber]
