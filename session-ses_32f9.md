# Creación de OpenCode skill

**Session ID:** ses_32f987a56ffeBS0gS5Cg62Wdw7
**Created:** 3/9/2026, 2:22:51 AM
**Updated:** 3/9/2026, 10:41:27 AM

---

## User

ayudame a crear una opencode skill

---

## Assistant

_Thinking:_

El usuario me pide ayuda para crear una "opencode skill". Esto se refiere a crear una habilidad/especialización para opencode, que es la herramienta que estoy usando actualmente.

Necesito buscar información sobre cómo crear skills en opencode. Voy a buscar en la documentación de opencode.

**Tool: webfetch**

---

## Assistant

_Thinking:_

Necesito buscar más información sobre cómo crear skills en opencode. Voy a buscar en la documentación.

**Tool: webfetch**

---

## Assistant

_Thinking:_

Encontré la documentación de OpenCode. Hay una sección sobre "Agent Skills" en /docs/skills/. Voy a buscar esa página específicamente para entender cómo crear skills.

**Tool: webfetch**

---

## Assistant

_Thinking:_

Ahora tengo toda la información necesaria para crear una skill de OpenCode. Voy a explicar al usuario cómo crear una.

Para crear una **OpenCode skill**, sigue estos pasos:

## 1. Estructura de archivos

Crea una carpeta con el nombre de tu skill y dentro un archivo `SKILL.md`:

```
.opencode/skills/<nombre>/SKILL.md
```

O globalmente en:
```
~/.config/opencode/skills/<nombre>/SKILL.md
```

## 2. Contenido del SKILL.md

Debe tener frontmatter YAML + contenido:

```yaml
---
name: mi-skill
description: Descripción de qué hace esta skill
license: MIT
compatibility: opencode
metadata:
  audience: maintainers
---

## Qué hago
- Primera capacidad
- Segunda capacidad

## Cuándo usarme
Usa esto cuando necesites...
```

## 3. Reglas

- **name**: 1-64 caracteres, minúsculas, guiones simples (no al inicio/final)
- **description**: 1-1024 caracteres
- El archivo debe llamarse exactamente `SKILL.md` (mayúsculas)

## Ejemplo completo

```markdown
---
name: git-release
description: Create consistent releases and changelogs
license: MIT
---

## What I do
- Draft release notes from merged PRs
- Propose a version bump
- Provide a copy-pasteable `gh release create` command

## When to use me
Use this when you are preparing a tagged release.
```

¿Quieres que te ayude a crear una skill específica?

---

## User

si quieroo una skill para Frontend con TalwindCSS que sea novedosa, cuidadosa, estructurada y organizada y sobre todo responsiva con mobile-first, que para moviles el layout sea Game Header Fijo, Main con scroll vertical oara permitir un flujo normal de documento y de en Footer, La BarNav.

---

## Assistant

_Thinking:_

El usuario quiere una skill de OpenCode para frontend con TailwindCSS que sea:
- Novedosa
- Cuidadosa
- Estructurada y organizada
- Responsive con mobile-first
- Para móviles: Game Header fijo, Main con scroll vertical, Footer con BarNav

Voy a crear una skill completa y detallada.

**Tool: bash**

---

## Assistant

_Thinking:_

Ahora voy a crear el archivo SKILL.md con todas las especificaciones que el usuario pidió.

**Tool: write**

---

## Assistant

_Thinking:_

He creado la skill. Ahora le explico al usuario lo que creé.

Listo! He creado la skill en:
```
~/.config/opencode/skills/tailwind-frontend-mobile-first/SKILL.md
```

## Características incluidas:

**Mobile Layout (Mobile-First)**
- **Game Header**: `fixed top-0` con z-index y padding para evitar superposición
- **Main**: `flex-1 overflow-y-auto` con scroll vertical natural
- **Bottom BarNav**: `fixed bottom-0` en zona de pulgar

**Técnicas clave:**
- Safe areas para dispositivos con notch (`env(safe-area-inset-*)`)
- Touch targets mínimos de 44px
- Prefijos responsive: `sm:`, `md:`, `lg:`, `xl:`
- Dark mode con `dark:` prefix
- Patrones de componentes listos para usar

**Estructura organizada:**
- Componentes de layout separados (Header, BottomNav, MobileLayout)
- Componentes UI reutilizables
- Hooks para detectar móvil

¿Quieres que agregue algo más o que cree ejemplo de código?

---

