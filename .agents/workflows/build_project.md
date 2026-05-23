---
name: build_project
description: Step-by-step workflow detailing commands to install dependencies, compile, and build the Next.js project.
---

# Build Project

Follow these steps to build the Pinturas Tecnicolor project:

1. **Install Dependencies**
   Run the following command to install all required Node.js packages.
   ```bash
   cmd /c "npm install"
   ```

2. **Compile / Typecheck**
   Run the TypeScript compiler to ensure there are no type errors.
   ```bash
   cmd /c "npm run typecheck"
   ```

3. **Build Project**
   Run the Next.js build script to create an optimized production build.
   ```bash
   cmd /c "npm run build"
   ```
