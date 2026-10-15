# FieldLog — Agent Working Rules & Guidelines

These rules are permanently active for all agent interactions within this project workspace (`d:\TECH\DailyREC`).

---

## 1. Language Rule
- **Mandatory English Responses**: Even if the user speaks, types, or prompts in Hindi or Hinglish, the agent **MUST ALWAYS respond in clear, professional English**.

---

## 2. Phased Development
- **Structured Steps**: Implement changes step-by-step in structured phases (one phase at a time).
- Do not attempt too many major changes simultaneously. Validate each phase before proceeding to the next.

---

## 3. Git & GitHub Tracking
- **Continuous Version Control**: Always commit and push changes to the project's GitHub repository (`origin/main`, `https://github.com/vishesh-i-tech/FieldLog.git`) after every phase or meaningful modification so the user's GitHub contribution graph stays active and current.
- Always include clear, concise commit messages.

---

## 4. Quick Response Time
- **Non-blocking Git Sync**: Do not block chat responses waiting for Git operations. Run pushes asynchronously in the background or right alongside code changes, and provide clear notifications when the push completes.
- Keep agent interaction snappy, direct, and actionable.

---

## 5. Technology & Architecture Explainer (`explainer.md`)
- **Continuous Documentation**: Maintain `explainer.md` in the project root.
- For every technology, library, framework, or architectural pattern introduced or changed:
  - **Technology Name**
  - **Role & Purpose**: What it does in this project.
  - **Under the Hood**: How it works internally.
  - **Summary**: Simple, key takeaway.

---

## 6. Functional & UX Standards
- **Workplace & Field Officer Mapping**: Every site / work place must have an assigned field officer, visible on the Owner dashboard with quick 1-click reassignment capabilities.
- **Modal Stability**: On React Native Web, never wrap modal sheets inside `<TouchableOpacity onPress={...}>` as click events bubble up. Always use `<TouchableOpacity style={StyleSheet.absoluteFillObject} ... />` as a background sibling behind the sheet.
- **Accurate Geotagging**: Photos must feature verifiable EXIF / device GPS data stamped on-device.
