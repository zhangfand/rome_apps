/* @ds-bundle: {"format":4,"namespace":"RomeDesignSystemOrange_5d924a","components":[{"name":"Alert","sourcePath":"components/Alert.jsx"},{"name":"AlertTitle","sourcePath":"components/Alert.jsx"},{"name":"AlertDescription","sourcePath":"components/Alert.jsx"},{"name":"Badge","sourcePath":"components/Badge.jsx"},{"name":"Button","sourcePath":"components/Button.jsx"},{"name":"Card","sourcePath":"components/Card.jsx"},{"name":"Input","sourcePath":"components/Input.jsx"},{"name":"SegmentedControl","sourcePath":"components/SegmentedControl.jsx"},{"name":"Select","sourcePath":"components/Select.jsx"},{"name":"Tabs","sourcePath":"components/Tabs.jsx"},{"name":"TabsList","sourcePath":"components/Tabs.jsx"},{"name":"TabsTrigger","sourcePath":"components/Tabs.jsx"},{"name":"TabsContent","sourcePath":"components/Tabs.jsx"}],"sourceHashes":{"components/Alert.jsx":"031389075181","components/Badge.jsx":"d8cd1dd437be","components/Button.jsx":"d9aa29ac4adf","components/Card.jsx":"8e7fe0e676c3","components/Input.jsx":"760605c61414","components/SegmentedControl.jsx":"cf35cb06037d","components/Select.jsx":"82befa7df6ca","components/Tabs.jsx":"7961441185b5","ui_kits/rome-os/ChatScreen.jsx":"b1289e8b3106","ui_kits/rome-os/app.jsx":"bbfbc2da1d1c","ui_kits/rome-os/data.jsx":"cd505c8faf34","ui_kits/rome-os/kit.jsx":"94491f09811d","ui_kits/rome-os/screens.jsx":"5ce35187b144"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.RomeDesignSystemOrange_5d924a = window.RomeDesignSystemOrange_5d924a || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/Alert.jsx
try { (() => {
/* Alert — an inline callout / message box (role="alert"), not a toast.
 * Mirrors packages/web/src/components/ui/alert.tsx: a bordered, tinted box
 * whose variants map to the semantic status tokens. Compose with AlertTitle
 * and AlertDescription; pass an `icon` (ReactNode) for the optional leading
 * glyph — the grid shifts to make room, exactly like the source. */
function alertVariant(variant) {
  const V = {
    default: {
      bg: "var(--surface)",
      fg: "var(--foreground)",
      bd: "var(--border)",
      icon: "var(--muted-foreground)"
    },
    info: {
      bg: "var(--info-bg)",
      fg: "var(--info-fg)",
      bd: "var(--info-border)",
      icon: "var(--info-fg)"
    },
    success: {
      bg: "var(--success-bg)",
      fg: "var(--success-fg)",
      bd: "var(--success-border)",
      icon: "var(--success-fg)"
    },
    warning: {
      bg: "var(--warning-bg)",
      fg: "var(--warning-fg)",
      bd: "var(--warning-border)",
      icon: "var(--warning-fg)"
    },
    destructive: {
      bg: "color-mix(in srgb, var(--destructive) 10%, transparent)",
      fg: "var(--destructive-fg)",
      bd: "color-mix(in srgb, var(--destructive) 40%, transparent)",
      icon: "var(--destructive-fg)"
    }
  };
  return V[variant] || V.default;
}
function Alert({
  variant = "default",
  icon = null,
  children,
  style
}) {
  const v = alertVariant(variant);
  return React.createElement("div", {
    role: "alert",
    style: {
      display: "grid",
      gridTemplateColumns: icon ? "1rem 1fr" : "0 1fr",
      columnGap: icon ? 12 : 0,
      rowGap: 2,
      alignItems: "start",
      width: "100%",
      border: "1px solid " + v.bd,
      borderRadius: "var(--r-md)",
      padding: "12px 16px",
      background: v.bg,
      color: v.fg,
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      ...style
    }
  }, icon ? React.createElement("span", {
    "aria-hidden": true,
    style: {
      gridColumn: "1",
      width: 16,
      height: 16,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: v.icon,
      transform: "translateY(2px)"
    }
  }, icon) : null, children);
}
function AlertTitle({
  children,
  style
}) {
  return React.createElement("div", {
    style: {
      gridColumn: "2",
      fontWeight: 500,
      lineHeight: 1.25,
      letterSpacing: "-0.01em",
      ...style
    }
  }, children);
}
function AlertDescription({
  children,
  style
}) {
  return React.createElement("div", {
    style: {
      gridColumn: "2",
      fontSize: 12,
      lineHeight: 1.6,
      opacity: 0.9,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Alert, AlertTitle, AlertDescription });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Alert.jsx", error: String((e && e.message) || e) }); }

// components/Badge.jsx
try { (() => {
/* Badge — a status chip. Pairs a tinted surface with a matching label and an
 * optional leading dot. Tones map to the semantic status tokens, so they
 * follow the active theme (info is warm ember). Sizing from --badge-*. */
function Badge({
  tone = "info",
  dot = false,
  children,
  style
}) {
  const tones = {
    info: {
      bg: "var(--info-bg)",
      fg: "var(--info-fg)",
      bd: "var(--info-border)",
      d: "var(--info)"
    },
    success: {
      bg: "var(--success-bg)",
      fg: "var(--success-fg)",
      bd: "var(--success-border)",
      d: "var(--success)"
    },
    warning: {
      bg: "var(--warning-bg)",
      fg: "var(--warning-fg)",
      bd: "var(--warning-border)",
      d: "var(--warning)"
    },
    destructive: {
      bg: "var(--destructive-bg)",
      fg: "var(--destructive-fg)",
      bd: "var(--destructive-border)",
      d: "var(--destructive)"
    },
    neutral: {
      bg: "var(--surface-muted)",
      fg: "var(--muted-foreground)",
      bd: "var(--border)",
      d: "var(--muted-foreground)"
    }
  };
  const t = tones[tone] || tones.info;
  return React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      boxSizing: "border-box",
      height: "var(--badge-h)",
      gap: "var(--badge-gap)",
      background: t.bg,
      color: t.fg,
      border: "var(--control-bw) solid " + t.bd,
      paddingLeft: dot ? "var(--badge-px-dot)" : "var(--badge-px)",
      paddingRight: "var(--badge-px)",
      borderRadius: "var(--badge-r)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--badge-fs)",
      fontWeight: 500,
      lineHeight: 1,
      whiteSpace: "nowrap",
      ...style
    }
  }, dot ? React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 999,
      background: t.d,
      flex: "none"
    }
  }) : null, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Badge.jsx", error: String((e && e.message) || e) }); }

// components/Button.jsx
try { (() => {
/* Button — the primary action primitive.
 * variant: primary (brand fill: ember coral), secondary
 * (surface + hairline), ghost (bare). One primary per screen.
 * Sizing comes entirely from the --control-* tokens: fixed height +
 * border-box, so every variant and size lines up with fields on the
 * same row and a border never changes the height. */
function Button({
  variant = "primary",
  size = "md",
  children,
  style,
  ...rest
}) {
  const sizes = {
    sm: {
      height: "var(--control-h-sm)",
      padding: "0 var(--control-px-sm)",
      fontSize: "var(--control-fs-sm)",
      gap: "var(--control-gap-sm)",
      borderRadius: "var(--control-r-sm)"
    },
    md: {
      height: "var(--control-h-md)",
      padding: "0 var(--control-px-md)",
      fontSize: "var(--control-fs-md)",
      gap: "var(--control-gap-md)",
      borderRadius: "var(--control-r-md)"
    },
    lg: {
      height: "var(--control-h-lg)",
      padding: "0 var(--control-px-lg)",
      fontSize: "var(--control-fs-lg)",
      gap: "var(--control-gap-lg)",
      borderRadius: "var(--control-r-lg)"
    }
  };
  const variants = {
    primary: {
      background: "var(--primary)",
      color: "var(--primary-foreground)",
      borderColor: "transparent"
    },
    secondary: {
      background: "var(--surface)",
      color: "var(--foreground)",
      borderColor: "var(--border-strong)"
    },
    ghost: {
      background: "transparent",
      color: "var(--muted-foreground)",
      borderColor: "transparent"
    }
  };
  return React.createElement("button", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
      borderStyle: "solid",
      borderWidth: "var(--control-bw)",
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      lineHeight: 1,
      cursor: "pointer",
      transition: "background 120ms var(--ease-classical)",
      ...sizes[size],
      ...variants[variant],
      ...style
    },
    ...rest
  }, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Button.jsx", error: String((e && e.message) || e) }); }

// components/Card.jsx
try { (() => {
/* Card — the surface container. 1px hairline + soft warm shadow (never both a
 * thick border and a heavy shadow). `elevated` lifts onto the white/raised
 * surface tone for popovers and sheets. */
function Card({
  children,
  padding = 24,
  elevated = false,
  style
}) {
  return React.createElement("div", {
    style: {
      background: elevated ? "var(--surface-elevated)" : "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)",
      boxShadow: elevated ? "var(--shadow-md)" : "var(--shadow-sm)",
      color: "var(--foreground)",
      padding,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Card.jsx", error: String((e && e.message) || e) }); }

// components/Input.jsx
try { (() => {
/* Input — single-line text field. Same --control-h-* heights as Button, so a
 * field and its submit button align on one row. Border width lives inside the
 * box and the focus ring is an outline (drawn outside the box), so focus and
 * invalid states never shift layout. On focus the border ALSO recolors to
 * --ring and the outline sits flush (offset 0) — both halves are needed, or
 * the light hairline shows as a stripe inside the ring. */
const fieldSizes = {
  sm: {
    height: "var(--control-h-sm)",
    borderRadius: "var(--control-r-sm)",
    padding: "0 var(--field-px-sm)"
  },
  md: {
    height: "var(--control-h-md)",
    borderRadius: "var(--control-r-md)",
    padding: "0 var(--field-px-md)"
  },
  lg: {
    height: "var(--control-h-lg)",
    borderRadius: "var(--control-r-lg)",
    padding: "0 var(--field-px-lg)"
  }
};
function Input({
  size = "md",
  invalid = false,
  style,
  onFocus,
  onBlur,
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  return React.createElement("input", {
    style: {
      boxSizing: "border-box",
      width: "100%",
      background: "var(--surface-elevated)",
      color: "var(--foreground)",
      borderStyle: "solid",
      borderWidth: "var(--control-bw)",
      borderColor: invalid ? "var(--destructive-border)" : focused ? "var(--ring)" : "var(--input)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--field-fs)",
      lineHeight: 1,
      outline: focused ? "1px solid var(--ring)" : "none",
      outlineOffset: 0,
      ...fieldSizes[size],
      ...style
    },
    onFocus: ev => {
      setFocused(true);
      if (onFocus) onFocus(ev);
    },
    onBlur: ev => {
      setFocused(false);
      if (onBlur) onBlur(ev);
    },
    ...rest
  });
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Input.jsx", error: String((e && e.message) || e) }); }

// components/SegmentedControl.jsx
try { (() => {
/* SegmentedControl — a single-select control for switching a view or filtering
 * a list. Lifted out of Tabs' old `default` list variant: the same muted track
 * with the active segment lifted onto the canvas surface, but a control API
 * (options + value) instead of a tab/panel pair, and radio semantics rather
 * than tablist. Reach for Tabs when each choice reveals its own panel of
 * content; reach for this when the choice narrows or reframes one view.
 * Heights come from --control-h-* so it lines up with Button and the fields. */
const SEG_SIZES = {
  sm: {
    h: "var(--control-h-sm)",
    fs: 13,
    px: 8,
    pad: 2
  },
  md: {
    h: "var(--control-h-md)",
    fs: 14,
    px: 10,
    pad: 3
  }
};
function SegmentedControl({
  options = [],
  value,
  defaultValue,
  onChange,
  size = "md",
  fullWidth = false,
  "aria-label": ariaLabel,
  style
}) {
  const [internal, setInternal] = React.useState(defaultValue !== undefined ? defaultValue : options[0] && options[0].value);
  const active = value !== undefined ? value : internal;
  const [hover, setHover] = React.useState(null);
  const s = SEG_SIZES[size] || SEG_SIZES.md;
  const select = v => {
    if (value === undefined) setInternal(v);
    if (onChange) onChange(v);
  };
  return React.createElement("div", {
    role: "radiogroup",
    "aria-label": ariaLabel,
    style: {
      display: fullWidth ? "flex" : "inline-flex",
      alignItems: "center",
      width: fullWidth ? "100%" : "fit-content",
      height: s.h,
      padding: s.pad,
      background: "var(--muted)",
      borderRadius: "var(--r-md)",
      boxSizing: "border-box",
      ...style
    }
  }, options.map(opt => {
    const isActive = active === opt.value;
    const isHover = hover === opt.value && !opt.disabled;
    return React.createElement("button", {
      key: opt.value,
      type: "button",
      role: "radio",
      "aria-checked": isActive,
      "data-state": isActive ? "active" : "inactive",
      disabled: opt.disabled,
      onMouseEnter: () => setHover(opt.value),
      onMouseLeave: () => setHover(null),
      onClick: () => !opt.disabled && select(opt.value),
      style: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        flex: fullWidth ? 1 : undefined,
        height: "100%",
        border: "1px solid transparent",
        borderRadius: "var(--r-sm)",
        padding: `0 ${s.px}px`,
        fontFamily: "var(--font-sans)",
        fontSize: s.fs,
        fontWeight: 500,
        whiteSpace: "nowrap",
        cursor: opt.disabled ? "not-allowed" : "pointer",
        opacity: opt.disabled ? 0.5 : 1,
        color: isActive || isHover ? "var(--foreground)" : "color-mix(in srgb, var(--foreground) 60%, transparent)",
        background: isActive ? "var(--background)" : "transparent",
        boxShadow: isActive ? "var(--shadow-sm)" : "none",
        transition: "color var(--dur-fast), background var(--dur-fast)"
      }
    }, opt.label);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/Select.jsx
try { (() => {
/* Select — native select with the chevron drawn by us. Shares every sizing
 * token with Input and Button; horizontal padding steps with size via
 * --field-px-*, and the extra right padding is --field-affordance so the
 * chevron never collides with a long option label. Focus matches Input: the
 * border recolors to --ring AND a flush 2px outline (offset 0) — both halves,
 * or the light hairline shows as a stripe inside the ring. */
const selectSizes = {
  sm: {
    height: "var(--control-h-sm)",
    borderRadius: "var(--control-r-sm)",
    padding: "0 var(--field-affordance) 0 var(--field-px-sm)"
  },
  md: {
    height: "var(--control-h-md)",
    borderRadius: "var(--control-r-md)",
    padding: "0 var(--field-affordance) 0 var(--field-px-md)"
  },
  lg: {
    height: "var(--control-h-lg)",
    borderRadius: "var(--control-r-lg)",
    padding: "0 var(--field-affordance) 0 var(--field-px-lg)"
  }
};
function Select({
  size = "md",
  invalid = false,
  children,
  style,
  onFocus,
  onBlur,
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  return React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex",
      width: "100%",
      "--field-px": "var(--field-px-" + size + ")"
    }
  }, React.createElement("select", {
    style: {
      appearance: "none",
      WebkitAppearance: "none",
      boxSizing: "border-box",
      width: "100%",
      background: "var(--surface-elevated)",
      color: "var(--foreground)",
      borderStyle: "solid",
      borderWidth: "var(--control-bw)",
      borderColor: invalid ? "var(--destructive-border)" : focused ? "var(--ring)" : "var(--input)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--field-fs)",
      lineHeight: 1,
      outline: focused ? "1px solid var(--ring)" : "none",
      outlineOffset: 0,
      cursor: "pointer",
      ...selectSizes[size],
      ...style
    },
    onFocus: ev => {
      setFocused(true);
      if (onFocus) onFocus(ev);
    },
    onBlur: ev => {
      setFocused(false);
      if (onBlur) onBlur(ev);
    },
    ...rest
  }, children), React.createElement("svg", {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--muted-foreground)",
    strokeWidth: 2.2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      position: "absolute",
      right: "calc(var(--field-px) - 1px)",
      top: "50%",
      transform: "translateY(-50%)",
      pointerEvents: "none"
    }
  }, React.createElement("polyline", {
    points: "6 9 12 15 18 9"
  })));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Select.jsx", error: String((e && e.message) || e) }); }

// components/Tabs.jsx
try { (() => {
/* Tabs — underline tabs: a transparent track where the active trigger grows a
 * 2px foreground bar along the bottom. Each tab owns a panel of content; for a
 * control that switches or filters a single view, use SegmentedControl (which
 * is the segmented treatment this component used to carry as a variant).
 * API: <Tabs value|defaultValue onValueChange> › <TabsList> › <TabsTrigger
 * value> and <TabsContent value>. */
const TabsCtx = React.createContext(null);
function Tabs({
  value,
  defaultValue,
  onValueChange,
  orientation = "horizontal",
  children,
  style
}) {
  const [internal, setInternal] = React.useState(defaultValue);
  const active = value !== undefined ? value : internal;
  const setValue = v => {
    if (value === undefined) setInternal(v);
    if (onValueChange) onValueChange(v);
  };
  return React.createElement(TabsCtx.Provider, {
    value: {
      active,
      setValue,
      orientation
    }
  }, React.createElement("div", {
    "data-orientation": orientation,
    style: {
      display: "flex",
      flexDirection: orientation === "vertical" ? "row" : "column",
      gap: 8,
      ...style
    }
  }, children));
}
function TabsList({
  children,
  style
}) {
  const {
    orientation
  } = React.useContext(TabsCtx) || {};
  return React.createElement("div", {
    role: "tablist",
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "fit-content",
      background: "transparent",
      gap: 4,
      ...(orientation === "vertical" ? {
        flexDirection: "column",
        height: "fit-content"
      } : null),
      ...style
    }
  }, children);
}
function TabsTrigger({
  value,
  children,
  disabled = false,
  style
}) {
  const {
    active,
    setValue,
    orientation
  } = React.useContext(TabsCtx) || {};
  const isActive = active === value;
  const [hover, setHover] = React.useState(false);
  return React.createElement("button", {
    role: "tab",
    type: "button",
    "aria-selected": isActive,
    "data-state": isActive ? "active" : "inactive",
    disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    onClick: () => !disabled && setValue && setValue(value),
    style: {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: orientation === "vertical" ? "flex-start" : "center",
      gap: 6,
      width: orientation === "vertical" ? "100%" : undefined,
      border: "1px solid transparent",
      borderRadius: 0,
      padding: "4px 8px",
      background: "transparent",
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      fontWeight: 500,
      whiteSpace: "nowrap",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      color: isActive || hover ? "var(--foreground)" : "color-mix(in srgb, var(--foreground) 60%, transparent)",
      transition: "color var(--dur-fast)",
      ...style
    }
  }, children, isActive ? React.createElement("span", {
    "aria-hidden": true,
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: -5,
      height: 2,
      background: "var(--foreground)"
    }
  }) : null);
}
function TabsContent({
  value,
  children,
  style
}) {
  const {
    active
  } = React.useContext(TabsCtx) || {};
  if (active !== value) return null;
  return React.createElement("div", {
    role: "tabpanel",
    style: {
      flex: 1,
      fontSize: 14,
      outline: "none",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Tabs, TabsList, TabsTrigger, TabsContent });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/rome-os/ChatScreen.jsx
try { (() => {
/* Chat screen — session topbar, thread (You / Rome with a tool + code block),
   a live "writing" indicator, and the composer. */
const {
  Icon: CIcon,
  Avatar: CAvatar,
  Kbd: CKbd
} = window.RomeKit;
function ChatTopBar() {
  const {
    Badge
  } = window.RomeDesignSystemOrange_5d924a;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "14px 24px",
      borderBottom: "1px solid var(--border)",
      flex: "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: 21,
      fontWeight: 500,
      letterSpacing: "-0.01em",
      color: "var(--foreground)"
    }
  }, "Draft the Friday newsletter"), /*#__PURE__*/React.createElement(Badge, {
    tone: "info",
    dot: true
  }, "Running"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      alignItems: "center",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      color: "var(--muted-foreground)"
    }
  }, "claude-sonnet \xB7 1,284 tokens"), /*#__PURE__*/React.createElement("button", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      border: "1px solid var(--border-strong)",
      background: "var(--surface)",
      borderRadius: "var(--r-sm)",
      padding: "7px 13px",
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      fontWeight: 500,
      color: "var(--foreground)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(CIcon, {
    name: "link",
    size: 15
  }), "Share")));
}
function Message({
  m
}) {
  const {
    Button
  } = window.RomeDesignSystemOrange_5d924a;
  const isYou = m.role === "you";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "36px 1fr",
      gap: 16
    }
  }, isYou ? /*#__PURE__*/React.createElement(CAvatar, {
    label: "YO",
    tone: "neutral",
    size: 36
  }) : /*#__PURE__*/React.createElement(CAvatar, {
    rome: true,
    tone: "ink",
    size: 36
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 13.5,
      fontWeight: 600,
      color: "var(--foreground)"
    }
  }, isYou ? "You" : "Rome"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      color: "var(--muted-foreground)"
    }
  }, m.when)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15.5,
      lineHeight: 1.55,
      color: "var(--foreground)",
      maxWidth: "68ch"
    },
    dangerouslySetInnerHTML: {
      __html: renderBody(m.body)
    }
  }), m.tool ? /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "12px 0",
      border: "1px solid var(--border)",
      borderRadius: "var(--r-md)",
      background: "var(--surface-muted)",
      overflow: "hidden",
      maxWidth: "68ch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "9px 12px",
      borderBottom: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      fontWeight: 600,
      color: "var(--muted-foreground)",
      background: "var(--surface)",
      border: "1px solid var(--border-strong)",
      padding: "2px 8px",
      borderRadius: 6
    }
  }, "tool"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 13,
      color: "var(--foreground)"
    }
  }, m.tool.name), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      color: "var(--muted-foreground)"
    }
  }, m.tool.loc))) : null, m.list ? /*#__PURE__*/React.createElement("ol", {
    style: {
      margin: "6px 0 0",
      paddingLeft: 22,
      fontSize: 15.5,
      lineHeight: 1.7,
      color: "var(--foreground)"
    }
  }, m.list.map((li, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      marginBottom: 2
    }
  }, li))) : null, m.actions ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm"
  }, "Schedule the first"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm"
  }, "Edit drafts"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm"
  }, "Try again")) : null));
}
function renderBody(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code style="font-family:var(--font-mono);font-size:0.88em;background:var(--surface-muted);padding:2px 6px;border-radius:6px;">$1</code>');
}
function TypingRow() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "36px 1fr",
      gap: 16,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(CAvatar, {
    rome: true,
    tone: "ink",
    size: 36
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontSize: 14.5,
      color: "var(--muted-foreground)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 999,
      background: "var(--info)"
    }
  }), "Scheduling the newsletter\u2026"));
}
function Composer() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 24px 22px",
      flex: "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      border: "1px solid var(--border-strong)",
      borderRadius: "var(--r-lg)",
      padding: "14px 16px 10px",
      background: "var(--surface)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: "var(--muted-foreground)"
    }
  }, "Ask a follow-up, or brief a new task\u2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      marginTop: 20,
      paddingTop: 10,
      borderTop: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontSize: 13,
      fontWeight: 500,
      color: "var(--muted-foreground)"
    }
  }, /*#__PURE__*/React.createElement(CIcon, {
    name: "paperclip",
    size: 15
  }), "Attach"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontFamily: "var(--font-mono)",
      fontSize: 13,
      color: "var(--muted-foreground)"
    }
  }, "/commands"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      fontFamily: "var(--font-mono)",
      fontSize: 11.5,
      color: "var(--subtle-foreground)"
    }
  }, "\u23CE send \xB7 \u21E7\u23CE newline"), /*#__PURE__*/React.createElement("button", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      background: "var(--primary)",
      color: "var(--primary-foreground)",
      border: "none",
      borderRadius: "var(--r-sm)",
      padding: "8px 15px",
      fontFamily: "var(--font-sans)",
      fontSize: 13.5,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(CIcon, {
    name: "arrow-up",
    size: 15,
    strokeWidth: 2
  }), "Send"))));
}
function ChatScreen() {
  const {
    thread
  } = window.RomeData;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ChatTopBar, null), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "26px 30px",
      display: "flex",
      flexDirection: "column",
      gap: 24
    }
  }, thread.map((m, i) => /*#__PURE__*/React.createElement(Message, {
    key: i,
    m: m
  })), /*#__PURE__*/React.createElement(TypingRow, null)), /*#__PURE__*/React.createElement(Composer, null));
}
Object.assign(window, {
  ChatScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/rome-os/ChatScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/rome-os/app.jsx
try { (() => {
/* Sidebar + App shell. App owns the active-screen state and the theme
   controller; Sidebar switches screens and toggles light/dark. */
const {
  Icon: KIcon,
  Eyebrow: KEyebrow,
  Avatar: KAvatar,
  Kbd: KKbd,
  useThemeControl: useThemeCtl
} = window.RomeKit;
const NAV = [{
  id: "chat",
  label: "Chat",
  icon: "message-square"
}, {
  id: "apps",
  label: "Apps",
  icon: "layout-grid"
}, {
  id: "projects",
  label: "Projects",
  icon: "folder"
}, {
  id: "activity",
  label: "Activity",
  icon: "activity"
}];
function SidebarRow({
  icon,
  label,
  active,
  onClick,
  trailing
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      padding: "8px 10px",
      borderRadius: "var(--r-sm)",
      border: "none",
      cursor: "pointer",
      fontFamily: "var(--font-sans)",
      fontSize: 13.5,
      fontWeight: active ? 600 : 500,
      color: active ? "var(--foreground)" : "var(--muted-foreground)",
      background: active ? "var(--surface)" : hover ? "var(--surface-hover)" : "transparent",
      boxShadow: active ? "var(--shadow-xs)" : "none",
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement(KIcon, {
    name: icon,
    size: 17
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, label), trailing);
}
function Sidebar({
  screen,
  setScreen,
  theme
}) {
  const {
    pinnedApps,
    chatGroups
  } = window.RomeData;
  const {
    mode,
    toggleMode
  } = theme;
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 256,
      flex: "none",
      height: "100%",
      boxSizing: "border-box",
      borderRight: "1px solid var(--border)",
      background: "var(--background)",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9,
      padding: "18px 18px 12px"
    }
  }, /*#__PURE__*/React.createElement(KAvatar, {
    rome: true,
    tone: "ink",
    size: 26
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 20,
      fontWeight: 700,
      letterSpacing: "-0.02em",
      color: "var(--foreground)"
    }
  }, "Rome")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 12px 6px"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setScreen("chat"),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      width: "100%",
      boxSizing: "border-box",
      padding: "9px 12px",
      borderRadius: "var(--r-sm)",
      cursor: "pointer",
      border: "1px solid var(--border-strong)",
      background: "var(--surface)",
      fontFamily: "var(--font-sans)",
      fontSize: 13.5,
      fontWeight: 500,
      color: "var(--foreground)"
    }
  }, /*#__PURE__*/React.createElement(KIcon, {
    name: "plus",
    size: 16
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      textAlign: "left"
    }
  }, "New chat"), /*#__PURE__*/React.createElement(KKbd, null, "\u2318\u21E7O"))), /*#__PURE__*/React.createElement("nav", {
    style: {
      padding: "6px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 1
    }
  }, NAV.map(n => /*#__PURE__*/React.createElement(SidebarRow, {
    key: n.id,
    icon: n.icon,
    label: n.label,
    active: screen === n.id,
    onClick: () => setScreen(n.id)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      overflowY: "auto",
      flex: 1,
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px 18px 6px"
    }
  }, /*#__PURE__*/React.createElement(KEyebrow, null, "AI Apps")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 14px 10px",
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 6
    }
  }, pinnedApps.map(a => /*#__PURE__*/React.createElement("button", {
    key: a.id,
    onClick: () => setScreen("apps"),
    title: a.label,
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 5,
      padding: "9px 4px",
      borderRadius: "var(--r-sm)",
      border: "none",
      cursor: "pointer",
      background: "transparent",
      color: "var(--muted-foreground)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      width: 32,
      height: 32,
      borderRadius: "var(--r-sm)",
      background: "var(--surface-muted)",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--foreground)"
    }
  }, /*#__PURE__*/React.createElement(KIcon, {
    name: a.icon,
    size: 17
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 10.5,
      color: "var(--subtle-foreground)",
      whiteSpace: "nowrap"
    }
  }, a.label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 18px 6px"
    }
  }, /*#__PURE__*/React.createElement(KEyebrow, null, "Chats")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 12px 12px"
    }
  }, chatGroups.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.label,
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      color: "var(--subtle-foreground)",
      padding: "6px 10px 4px"
    }
  }, g.label), g.items.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.id,
    onClick: () => setScreen("chat"),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      width: "100%",
      boxSizing: "border-box",
      padding: "7px 10px",
      borderRadius: "var(--r-sm)",
      border: "none",
      cursor: "pointer",
      textAlign: "left",
      background: c.active && screen === "chat" ? "var(--surface)" : "transparent",
      boxShadow: c.active && screen === "chat" ? "var(--shadow-xs)" : "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 999,
      flex: "none",
      background: c.active ? "var(--ring)" : "transparent"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      color: c.active ? "var(--foreground)" : "var(--muted-foreground)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, c.title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 10.5,
      color: "var(--subtle-foreground)"
    }
  }, c.when))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid var(--border)",
      padding: "8px 12px",
      display: "flex",
      alignItems: "center",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(SidebarRow, {
    icon: "settings",
    label: "Settings",
    active: screen === "settings",
    onClick: () => setScreen("settings")
  })), /*#__PURE__*/React.createElement("button", {
    onClick: toggleMode,
    title: mode === "dark" ? "Switch to light" : "Switch to dark",
    style: {
      display: "inline-flex",
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--r-sm)",
      border: "none",
      background: "transparent",
      color: "var(--muted-foreground)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(KIcon, {
    name: mode === "dark" ? "sun" : "moon",
    size: 17
  }))));
}
function App() {
  const theme = useThemeCtl();
  const [screen, setScreen] = React.useState("chat");
  const S = {
    chat: window.ChatScreen,
    apps: window.AppsScreen,
    projects: window.ProjectsScreen,
    activity: window.ActivityScreen,
    settings: window.SettingsScreen
  };
  const Screen = S[screen] || (() => null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      height: "100vh",
      width: "100%",
      background: "var(--background)",
      color: "var(--foreground)",
      fontFamily: "var(--font-sans)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    screen: screen,
    setScreen: setScreen,
    theme: theme
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement(Screen, {
    theme: theme
  })));
}
Object.assign(window, {
  RomeApp: App
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/rome-os/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/rome-os/data.jsx
try { (() => {
/* Mock content for the Rome OS kit. Grounded in the real product: a personal
   AI OS you chat with, install apps into, connect channels, and schedule
   routines. Voice follows the brand: calm, plain, past-tense confirmations. */

const chatGroups = [{
  label: "Today",
  items: [{
    id: "c1",
    title: "Draft the Friday newsletter",
    when: "9:02",
    active: true
  }, {
    id: "c2",
    title: "Reconcile March invoices",
    when: "8:41"
  }, {
    id: "c3",
    title: "Reply to the Kaplan thread",
    when: "8:15"
  }]
}, {
  label: "Yesterday",
  items: [{
    id: "c4",
    title: "Set up the WhatsApp channel",
    when: "Tue"
  }, {
    id: "c5",
    title: "Weekly books summary",
    when: "Tue"
  }, {
    id: "c6",
    title: "Onboard the new supplier",
    when: "Mon"
  }]
}];

// The pinned "AI Apps" grid in the sidebar.
const pinnedApps = [{
  id: "briefing",
  label: "Briefing",
  icon: "sunrise"
}, {
  id: "books",
  label: "Bookkeeper",
  icon: "receipt"
}, {
  id: "inbox",
  label: "Inbox",
  icon: "inbox"
}, {
  id: "coding",
  label: "Coding",
  icon: "square-terminal"
}];

// Full apps index — installed apps + access mode.
const installedApps = [{
  id: "briefing",
  name: "Briefing",
  icon: "sunrise",
  desc: "A morning digest of what needs you — pulled from mail, books, and calendar.",
  access: "private",
  updated: "2d ago"
}, {
  id: "books",
  name: "Bookkeeper",
  icon: "receipt",
  desc: "Reconciles invoices and payments, flags anything that doesn't add up.",
  access: "private",
  updated: "5d ago"
}, {
  id: "inbox",
  name: "Inbox",
  icon: "inbox",
  desc: "Triages customer email and drafts replies in your voice for review.",
  access: "cloud",
  updated: "1w ago"
}, {
  id: "coding",
  name: "Coding",
  icon: "square-terminal",
  desc: "A pair for small changes to your site and internal tools.",
  access: "private",
  updated: "1w ago"
}, {
  id: "storefront",
  name: "Storefront",
  icon: "store",
  desc: "A public order page customers can reach without signing in.",
  access: "public",
  updated: "2w ago"
}, {
  id: "replay",
  name: "Replay",
  icon: "history",
  desc: "Records and replays browser tasks so routine web work runs itself.",
  access: "private",
  updated: "3w ago"
}];
const accessMeta = {
  private: {
    label: "Private",
    tone: "neutral",
    icon: "lock"
  },
  public: {
    label: "Public",
    tone: "warning",
    icon: "globe"
  },
  cloud: {
    label: "Rome Cloud",
    tone: "info",
    icon: "mail"
  }
};

// Activity / routines.
const routines = [{
  id: "r1",
  name: "Morning briefing",
  schedule: "Weekdays · 7:00",
  trigger: "scheduled",
  app: "Briefing",
  on: true,
  last: "Ran today, 7:00"
}, {
  id: "r2",
  name: "New order → draft reply",
  schedule: "On new Storefront order",
  trigger: "event",
  app: "Inbox",
  on: true,
  last: "Ran 3× today"
}, {
  id: "r3",
  name: "Weekly books summary",
  schedule: "Fridays · 16:00",
  trigger: "scheduled",
  app: "Bookkeeper",
  on: true,
  last: "Ran Fri, 16:00"
}, {
  id: "r4",
  name: "Low-stock nudge",
  schedule: "On inventory < 10",
  trigger: "event",
  app: "Storefront",
  on: false,
  last: "Paused"
}];
const activityFeed = [{
  id: "a1",
  app: "Briefing",
  tone: "info",
  text: "Filed today's briefing — 3 things need you.",
  when: "7:00"
}, {
  id: "a2",
  app: "Inbox",
  tone: "success",
  text: "Drafted 2 replies for the Kaplan thread.",
  when: "8:14"
}, {
  id: "a3",
  app: "Bookkeeper",
  tone: "warning",
  text: "Flagged an invoice that doesn't match the payment.",
  when: "8:41"
}, {
  id: "a4",
  app: "Coding",
  tone: "success",
  text: "Shipped the pricing-page copy change.",
  when: "Yesterday"
}];

// Projects / memory file browser.
const fileTree = [{
  name: "briefings",
  type: "folder",
  open: true,
  children: [{
    name: "2026-03-14.md",
    type: "file"
  }, {
    name: "2026-03-13.md",
    type: "file"
  }]
}, {
  name: "customers",
  type: "folder",
  open: false
}, {
  name: "suppliers",
  type: "folder",
  open: false
}, {
  name: "brand-voice.md",
  type: "file"
}, {
  name: "pricing.md",
  type: "file",
  active: true
}, {
  name: "hours.md",
  type: "file"
}];

// Chat thread messages.
const thread = [{
  role: "you",
  when: "9:01",
  body: "Draft three subject lines for Friday's newsletter about the spring menu, then schedule the best one for 9am."
}, {
  role: "rome",
  when: "9:01",
  body: "Pulled the spring menu from **pricing.md** and last month's open rates. Three drafts, warmest tone first:",
  tool: {
    name: "read_file",
    loc: "memory/pricing.md"
  },
  list: ["\u201cSpring's on the menu \u2014 and it's a good one\u201d", "\u201cNew this week: asparagus, rhubarb, and a plan\u201d", "\u201cYour Friday order, now with spring\u201d"],
  actions: true
}];
Object.assign(window, {
  RomeData: {
    chatGroups,
    pinnedApps,
    installedApps,
    accessMeta,
    routines,
    activityFeed,
    fileTree,
    thread
  }
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/rome-os/data.jsx", error: String((e && e.message) || e) }); }

// ui_kits/rome-os/kit.jsx
try { (() => {
/* Rome OS kit — shared atoms + theme controller.
   Exports to window.RomeKit so the other text/babel screen files can read them.
   Icons use Lucide (per the DS iconography rules). */

// Lucide-backed icon. Renders an <i data-lucide> and lets Lucide swap in the
// SVG; re-runs on every render so name changes take effect.
function Icon({
  name,
  size = 18,
  strokeWidth = 1.75,
  style
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (window.lucide && ref.current) {
      ref.current.innerHTML = "";
      const el = document.createElement("i");
      el.setAttribute("data-lucide", name);
      ref.current.appendChild(el);
      window.lucide.createIcons({
        attrs: {
          "stroke-width": strokeWidth,
          width: size,
          height: size
        },
        nameAttr: "data-lucide"
      });
    }
  });
  return React.createElement("span", {
    ref,
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      ...style
    }
  });
}

// Eyebrow / small-caps mono label.
function Eyebrow({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      fontWeight: 500,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      color: "var(--fg-3)",
      ...style
    }
  }, children);
}

// Circular monogram avatar. `rome` = the brand mark tile; otherwise initials.
function Avatar({
  label,
  tone = "neutral",
  size = 32,
  rome = false
}) {
  const tones = {
    neutral: {
      bg: "var(--surface-muted)",
      fg: "var(--muted-foreground)"
    },
    brand: {
      bg: "var(--primary)",
      fg: "var(--primary-foreground)"
    },
    ink: {
      bg: "var(--slate)",
      fg: "#fff"
    },
    info: {
      bg: "var(--info-bg)",
      fg: "var(--info-fg)"
    },
    success: {
      bg: "var(--success-bg)",
      fg: "var(--success-fg)"
    }
  };
  const t = tones[tone] || tones.neutral;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: 999,
      flex: "none",
      background: t.bg,
      color: t.fg,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: rome ? "var(--font-sans)" : "var(--font-serif)",
      fontSize: rome ? size * 0.5 : size * 0.42,
      fontWeight: 600,
      letterSpacing: "-0.02em"
    }
  }, rome ? /*#__PURE__*/React.createElement(Icon, {
    name: "monitor",
    size: size * 0.5,
    strokeWidth: 2
  }) : label);
}
function Kbd({
  children
}) {
  return /*#__PURE__*/React.createElement("kbd", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 10.5,
      fontWeight: 500,
      color: "var(--fg-3)",
      background: "var(--surface-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 6,
      padding: "2px 6px",
      boxShadow: "var(--inset-key)"
    }
  }, children);
}

// Mode controller — persists light/dark and applies it to <html>. Ember is
// the only theme, so there is nothing to switch on the theme axis.
function useThemeControl() {
  const read = (k, d) => {
    try {
      return window.localStorage.getItem(k) || d;
    } catch {
      return d;
    }
  };
  const [mode, setModeState] = React.useState(() => read("romekit-mode", "light"));
  React.useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", "ember");
    root.classList.toggle("dark", mode === "dark");
    root.style.colorScheme = mode;
    try {
      window.localStorage.setItem("romekit-mode", mode);
    } catch (e) {/* private mode */}
  }, [mode]);
  return {
    theme: "ember",
    mode,
    toggleMode: () => setModeState(m => m === "dark" ? "light" : "dark"),
    setMode: setModeState
  };
}
Object.assign(window, {
  RomeKit: {
    Icon,
    Eyebrow,
    Avatar,
    Kbd,
    useThemeControl
  }
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/rome-os/kit.jsx", error: String((e && e.message) || e) }); }

// ui_kits/rome-os/screens.jsx
try { (() => {
/* Apps, Projects, Activity, Settings screens. */
const {
  Icon: SIcon,
  Eyebrow: SEyebrow,
  Avatar: SAvatar
} = window.RomeKit;
function DS() {
  return window.RomeDesignSystemOrange_5d924a;
}
function PageHeader({
  title,
  sub,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      gap: 16,
      padding: "22px 30px 18px",
      borderBottom: "1px solid var(--border)",
      flex: "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: "var(--font-serif)",
      fontSize: 30,
      fontWeight: 500,
      letterSpacing: "-0.02em",
      color: "var(--foreground)"
    }
  }, title), sub ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "6px 0 0",
      fontSize: 14,
      color: "var(--muted-foreground)",
      maxWidth: "62ch"
    }
  }, sub) : null), action);
}
function ScreenScroll({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "24px 30px"
    }
  }, children);
}
function Switch({
  on,
  onChange
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onChange,
    role: "switch",
    "aria-checked": on,
    style: {
      width: 38,
      height: 22,
      borderRadius: 999,
      border: "none",
      cursor: "pointer",
      padding: 2,
      flex: "none",
      background: on ? "var(--primary)" : "var(--border-strong)",
      transition: "background 150ms",
      display: "flex",
      alignItems: "center",
      justifyContent: on ? "flex-end" : "flex-start"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 18,
      borderRadius: 999,
      background: "var(--surface-elevated)",
      boxShadow: "var(--shadow-sm)"
    }
  }));
}

/* ── Apps ── */
function AppsScreen() {
  const {
    Card,
    Badge,
    Button,
    Alert,
    AlertDescription
  } = DS();
  const {
    installedApps,
    accessMeta
  } = window.RomeData;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Apps",
    sub: "The apps installed on your Rome. Set who can reach each one from its card.",
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "primary"
    }, /*#__PURE__*/React.createElement(SIcon, {
      name: "plus",
      size: 16,
      style: {
        marginRight: 6
      }
    }), "Add app")
  }), /*#__PURE__*/React.createElement(ScreenScroll, null, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 940,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement(Alert, {
    variant: "info",
    icon: /*#__PURE__*/React.createElement(SIcon, {
      name: "info",
      size: 16
    }),
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(AlertDescription, null, "Two apps are reachable outside your dashboard \u2014 ", /*#__PURE__*/React.createElement("strong", null, "Storefront"), " is public and ", /*#__PURE__*/React.createElement("strong", null, "Inbox"), " is limited to your Rome Cloud email list.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: 16
    }
  }, installedApps.map(a => {
    const am = accessMeta[a.access];
    return /*#__PURE__*/React.createElement(Card, {
      key: a.id
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        width: 40,
        height: 40,
        borderRadius: "var(--r-md)",
        background: "var(--surface-muted)",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--foreground)",
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement(SIcon, {
      name: a.icon,
      size: 20
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-sans)",
        fontSize: 15,
        fontWeight: 600,
        color: "var(--foreground)"
      }
    }, a.name), /*#__PURE__*/React.createElement(Badge, {
      tone: am.tone,
      dot: false,
      style: {
        marginLeft: "auto"
      }
    }, /*#__PURE__*/React.createElement(SIcon, {
      name: am.icon,
      size: 12,
      style: {
        marginRight: 4
      }
    }), am.label)), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "6px 0 0",
        fontSize: 13,
        lineHeight: 1.5,
        color: "var(--muted-foreground)"
      }
    }, a.desc))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginTop: 14
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--subtle-foreground)"
      }
    }, "Updated ", a.updated), /*#__PURE__*/React.createElement("div", {
      style: {
        marginLeft: "auto",
        display: "flex",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm"
    }, "Open"), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm"
    }, /*#__PURE__*/React.createElement(SIcon, {
      name: "ellipsis",
      size: 16
    })))));
  })))));
}

/* ── Projects / file browser ── */
function TreeNode({
  node,
  depth
}) {
  const [open, setOpen] = React.useState(!!node.open);
  const isFolder = node.type === "folder";
  const pad = 10 + depth * 14;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    onClick: () => isFolder && setOpen(o => !o),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      width: "100%",
      boxSizing: "border-box",
      padding: "6px 10px",
      paddingLeft: pad,
      border: "none",
      cursor: "pointer",
      textAlign: "left",
      borderRadius: "var(--r-sm)",
      background: node.active ? "var(--surface-hover)" : "transparent",
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      color: node.active ? "var(--foreground)" : "var(--muted-foreground)",
      fontWeight: node.active ? 600 : 400
    }
  }, isFolder ? /*#__PURE__*/React.createElement(SIcon, {
    name: open ? "chevron-down" : "chevron-right",
    size: 14,
    style: {
      color: "var(--subtle-foreground)"
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14
    }
  }), /*#__PURE__*/React.createElement(SIcon, {
    name: isFolder ? open ? "folder-open" : "folder" : "file-text",
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, node.name)), isFolder && open && node.children ? node.children.map((c, i) => /*#__PURE__*/React.createElement(TreeNode, {
    key: i,
    node: c,
    depth: depth + 1
  })) : null);
}
function ProjectsScreen() {
  const {
    Badge
  } = DS();
  const {
    fileTree
  } = window.RomeData;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Projects",
    sub: "Rome's memory and working files. Everything an app reads or writes lives here."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 260,
      flex: "none",
      borderRight: "1px solid var(--border)",
      overflowY: "auto",
      padding: "14px 12px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 8px 8px"
    }
  }, /*#__PURE__*/React.createElement(SEyebrow, null, "Memory")), fileTree.map((n, i) => /*#__PURE__*/React.createElement(TreeNode, {
    key: i,
    node: n,
    depth: 0
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      overflowY: "auto",
      padding: "22px 28px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      color: "var(--muted-foreground)"
    }
  }, /*#__PURE__*/React.createElement("span", null, "memory"), /*#__PURE__*/React.createElement(SIcon, {
    name: "chevron-right",
    size: 13
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--foreground)"
    }
  }, "pricing.md"), /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    dot: true,
    style: {
      marginLeft: 10
    }
  }, "Synced")), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "70ch"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: 28,
      fontWeight: 500,
      letterSpacing: "-0.02em",
      margin: "0 0 14px",
      color: "var(--foreground)"
    }
  }, "Spring pricing"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15.5,
      lineHeight: 1.6,
      color: "var(--foreground)",
      margin: "0 0 12px"
    }
  }, "The spring menu runs from March 15. Asparagus and rhubarb are the anchor items; both are priced for a 62% margin at current supplier rates."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15.5,
      lineHeight: 1.6,
      color: "var(--muted-foreground)",
      margin: 0
    }
  }, "Bookkeeper reconciles these against the Storefront orders nightly. Last change filed by the Coding app, 2 days ago.")))));
}

/* ── Activity / Routines ── */
function ActivityScreen() {
  const {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Alert,
    AlertTitle,
    AlertDescription,
    Badge
  } = DS();
  const {
    activityFeed,
    routines
  } = window.RomeData;
  const toneIcon = {
    info: "sunrise",
    success: "check",
    warning: "triangle-alert"
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Activity",
    sub: "What your apps have done, and the routines that keep them running on their own."
  }), /*#__PURE__*/React.createElement(ScreenScroll, null, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 820,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    defaultValue: "feed"
  }, /*#__PURE__*/React.createElement(TabsList, {
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(TabsTrigger, {
    value: "feed"
  }, "Recent"), /*#__PURE__*/React.createElement(TabsTrigger, {
    value: "routines"
  }, "Routines")), /*#__PURE__*/React.createElement(TabsContent, {
    value: "feed"
  }, /*#__PURE__*/React.createElement(Alert, {
    variant: "warning",
    icon: /*#__PURE__*/React.createElement(SIcon, {
      name: "triangle-alert",
      size: 16
    }),
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(AlertTitle, null, "1 thing needs you"), /*#__PURE__*/React.createElement(AlertDescription, null, "Bookkeeper flagged an invoice that doesn't match its payment. Review it before Friday's summary.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, activityFeed.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 10px",
      borderBottom: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      width: 30,
      height: 30,
      borderRadius: 999,
      background: `var(--${f.tone}-bg)`,
      color: `var(--${f.tone}-fg)`,
      alignItems: "center",
      justifyContent: "center",
      flex: "none"
    }
  }, /*#__PURE__*/React.createElement(SIcon, {
    name: toneIcon[f.tone],
    size: 15
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: "var(--foreground)"
    }
  }, f.text), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--subtle-foreground)",
      marginTop: 2
    }
  }, f.app)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11.5,
      color: "var(--muted-foreground)"
    }
  }, f.when))))), /*#__PURE__*/React.createElement(TabsContent, {
    value: "routines"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, routines.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "14px 16px",
      border: "1px solid var(--border)",
      borderRadius: "var(--r-md)",
      background: "var(--surface)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      width: 34,
      height: 34,
      borderRadius: "var(--r-sm)",
      background: "var(--surface-muted)",
      color: "var(--foreground)",
      alignItems: "center",
      justifyContent: "center",
      flex: "none"
    }
  }, /*#__PURE__*/React.createElement(SIcon, {
    name: r.trigger === "scheduled" ? "clock" : "zap",
    size: 17
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14.5,
      fontWeight: 500,
      color: "var(--foreground)"
    }
  }, r.name), /*#__PURE__*/React.createElement(Badge, {
    tone: r.trigger === "event" ? "info" : "neutral"
  }, r.trigger === "event" ? "Event" : "Scheduled")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11.5,
      color: "var(--muted-foreground)",
      marginTop: 3
    }
  }, r.schedule, " \xB7 ", r.app, " \xB7 ", r.last)), /*#__PURE__*/React.createElement(Switch, {
    on: r.on,
    onChange: () => {}
  })))))))));
}

/* ── Settings ── */
function SettingsRow({
  icon,
  title,
  sub,
  trailing
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "14px 0",
      borderBottom: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      width: 34,
      height: 34,
      borderRadius: "var(--r-sm)",
      background: "var(--surface-muted)",
      color: "var(--foreground)",
      alignItems: "center",
      justifyContent: "center",
      flex: "none"
    }
  }, /*#__PURE__*/React.createElement(SIcon, {
    name: icon,
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: "var(--foreground)"
    }
  }, title), sub ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--muted-foreground)",
      marginTop: 2
    }
  }, sub) : null), trailing);
}
function SettingsScreen({
  theme
}) {
  const {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Button,
    Badge
  } = DS();
  const channels = [{
    id: "telegram",
    name: "Telegram",
    icon: "send",
    connected: true
  }, {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "message-circle",
    connected: true
  }, {
    id: "discord",
    name: "Discord",
    icon: "gamepad-2",
    connected: false
  }, {
    id: "wechat",
    name: "WeChat",
    icon: "message-square",
    connected: false
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Settings",
    sub: "How Rome looks, where it reaches you, and which models it runs on."
  }), /*#__PURE__*/React.createElement(ScreenScroll, null, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 760,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    defaultValue: "appearance"
  }, /*#__PURE__*/React.createElement(TabsList, {
    style: {
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement(TabsTrigger, {
    value: "appearance"
  }, "Appearance"), /*#__PURE__*/React.createElement(TabsTrigger, {
    value: "channels"
  }, "Channels"), /*#__PURE__*/React.createElement(TabsTrigger, {
    value: "ai"
  }, "AI tools")), /*#__PURE__*/React.createElement(TabsContent, {
    value: "appearance"
  }, /*#__PURE__*/React.createElement(SEyebrow, null, "Theme"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13.5,
      color: "var(--muted-foreground)",
      margin: "10px 0 22px",
      maxWidth: "58ch"
    }
  }, "Ember \u2014 warm linen and ember coral. Rome's single theme, in light and dark."), /*#__PURE__*/React.createElement(SettingsRow, {
    icon: "moon",
    title: "Dark mode",
    sub: "Cast iron at dusk \u2014 a warm charcoal canvas.",
    trailing: /*#__PURE__*/React.createElement(Switch, {
      on: theme.mode === "dark",
      onChange: theme.toggleMode
    })
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    icon: "type",
    title: "Display font",
    sub: "Petrona for headings, Funnel Sans for UI.",
    trailing: /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: "var(--muted-foreground)"
      }
    }, "Default")
  })), /*#__PURE__*/React.createElement(TabsContent, {
    value: "channels"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13.5,
      color: "var(--muted-foreground)",
      margin: "0 0 16px",
      maxWidth: "58ch"
    }
  }, "Talk to Rome from the apps you already use. Connected channels route messages to the right app."), channels.map(c => /*#__PURE__*/React.createElement(SettingsRow, {
    key: c.id,
    icon: c.icon,
    title: c.name,
    sub: c.connected ? "Connected" : "Not connected",
    trailing: c.connected ? /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      dot: true
    }, "Live") : /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm"
    }, "Connect")
  }))), /*#__PURE__*/React.createElement(TabsContent, {
    value: "ai"
  }, /*#__PURE__*/React.createElement(SettingsRow, {
    icon: "sparkles",
    title: "Default model",
    sub: "Used unless an app overrides it.",
    trailing: /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: 12.5,
        color: "var(--foreground)"
      }
    }, "claude-sonnet")
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    icon: "gauge",
    title: "Fast model",
    sub: "For lightweight, high-volume steps.",
    trailing: /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: 12.5,
        color: "var(--foreground)"
      }
    }, "claude-haiku")
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    icon: "key",
    title: "Claude account",
    sub: "Signed in \u2014 tokens billed to your account.",
    trailing: /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      dot: true
    }, "Connected")
  }))))));
}
Object.assign(window, {
  AppsScreen,
  ProjectsScreen,
  ActivityScreen,
  SettingsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/rome-os/screens.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.AlertTitle = __ds_scope.AlertTitle;

__ds_ns.AlertDescription = __ds_scope.AlertDescription;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.TabsList = __ds_scope.TabsList;

__ds_ns.TabsTrigger = __ds_scope.TabsTrigger;

__ds_ns.TabsContent = __ds_scope.TabsContent;

})();
