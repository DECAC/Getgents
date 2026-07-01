import type { Espace } from "@/lib/types";

export function EmptyCenter({ espace }: { espace: Espace }) {
  return (
    <div className="mx-auto max-w-[680px] pt-[60px] text-center text-muted-foreground">
      <div className="mb-2.5 text-[34px]">{espace.icon}</div>
      <p className="mx-auto max-w-[340px] text-[13.5px]">
        Cet espace ne génère pas encore d&apos;artefact dédié. Ouvrez la conversation pour
        échanger avec votre assistant.
      </p>
    </div>
  );
}
