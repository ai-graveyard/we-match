"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

import { useActionState, useState } from "react";
import {
  createOrgAction,
  type OrgFormState,
} from "@/app/actions/orgs";
import { ORG_LIMITS } from "@/lib/orgs";
import { VisibilityPicker } from "@/components/org-forms";
import { useDict } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/fmt";
import {
  fieldError,
  input as inputCls,
  panel,
  primaryBtn,
  sectionLabel as labelCls,
  textarea as textareaCls,
} from "@/lib/ui";

export function CreateOrgForm() {
  const t = useDict();
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    createOrgAction,
    {},
  );
  const [visibility, setVisibility] = useState<"public" | "private">("private");

  return (
    <form
      action={formAction}
      className={`flex flex-col gap-4 ${panel} p-4`}
    >
      <div>
        <Label htmlFor="org-name" className={`${labelCls} mb-1 block`}>
          {fmt(t.org.formNameWithLimit, { max: ORG_LIMITS.name })}
        </Label>
        <Input
          id="org-name"
          name="name"
          className={inputCls}
          maxLength={ORG_LIMITS.name}
          required
          autoFocus
        />
      </div>

      <div>
        <Label htmlFor="org-desc" className={`${labelCls} mb-1 block`}>
          {t.org.formDescription}
        </Label>
        <Textarea
          id="org-desc"
          name="description"
          rows={4}
          className={textareaCls}
          maxLength={ORG_LIMITS.description}
        />
      </div>

      <div>
        <span className={`${labelCls} mb-1 block`}>{t.org.formType}</span>
        <VisibilityPicker value={visibility} onChange={setVisibility} />
      </div>

      {state.error && <p className={fieldError}>{state.error}</p>}

      <Button variant="plain" size="plain" type="submit" disabled={pending} className={primaryBtn}>
        {pending ? t.common.saving : t.common.save}
      </Button>
    </form>
  );
}
