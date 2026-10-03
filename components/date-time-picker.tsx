"use client";

import { useState } from "react";
import { format, isValid } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormSelect } from "@/components/ui/form-select";
import { useDict, useLocale } from "@/lib/i18n/client";

export function DateTimePicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const t = useDict();
  const parsed = new Date(value);
  const selected = isValid(parsed) ? parsed : undefined;
  const hour = value.slice(11, 13) || "00";
  const minute = value.slice(14, 16) || "00";
  return (
    <div className="mt-2 space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" aria-label={label} className="w-full justify-between border-line font-mono text-xs font-normal tracking-normal hover:bg-bg-3 hover:text-ink">
            {selected ? format(selected, "yyyy-MM-dd") : label}
            <CalendarIcon size={16} aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0" collisionPadding={16}>
          <Calendar mode="single" locale={locale === "zh" ? zhCN : enUS} selected={selected} defaultMonth={selected}
            onSelect={(date) => {
              if (!date) return;
              onChange(`${format(date, "yyyy-MM-dd")}T${hour}:${minute}`);
              setOpen(false);
            }} />
        </PopoverContent>
      </Popover>
      <div className="flex items-center gap-2">
        <FormSelect label={t.need.formHour} value={hour} className="flex-1 font-mono"
          options={Array.from({ length: 24 }, (_, i) => ({ value: String(i).padStart(2, "0"), label: String(i).padStart(2, "0") }))}
          onValueChange={(hour) => onChange(`${value.slice(0, 10)}T${hour}:${minute}`)} />
        <span aria-hidden>:</span>
        <FormSelect label={t.need.formMinute} value={minute} className="flex-1 font-mono"
          options={Array.from({ length: 60 }, (_, i) => ({ value: String(i).padStart(2, "0"), label: String(i).padStart(2, "0") }))}
          onValueChange={(minute) => onChange(`${value.slice(0, 10)}T${hour}:${minute}`)} />
      </div>
    </div>
  );
}
