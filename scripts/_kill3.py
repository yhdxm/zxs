import ctypes, sys

kernel32 = ctypes.windll.kernel32
targets = [17208, 18820, 15808]
for pid in targets:
    h = kernel32.OpenProcess(0x0001, False, pid)  # PROCESS_TERMINATE
    if not h:
        print(f"pid {pid}: cannot open (already gone?)")
        continue
    rc = kernel32.TerminateProcess(h, 0)
    kernel32.CloseHandle(h)
    print(f"pid {pid}: TerminateProcess rc={rc} -> {'killed' if rc else 'FAILED'}")
