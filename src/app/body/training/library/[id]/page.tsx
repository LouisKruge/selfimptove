import Link from "next/link";
import { notFound } from "next/navigation";
import { listExercises, workoutDetail } from "@/lib/services/body";
import {
  Badge,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  Section,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import {
  DeleteWorkoutButton,
  PrescriptionForm,
  PrescriptionList,
  QuickStartButton,
  WorkoutEditForm,
} from "@/components/training/WorkoutForms";

export const dynamic = "force-dynamic";

export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = workoutDetail(id);
  if (!detail) notFound();

  const exercises = listExercises().map((e) => ({
    value: e.id,
    label: `${e.name}${e.muscle_group ? ` · ${e.muscle_group}` : ""}`,
  }));

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={`Workout · ${detail.workout.type}`}
        title={detail.workout.name}
        description={detail.workout.description ?? detail.workout.focus ?? undefined}
        actions={
          <>
            <QuickStartButton workoutId={detail.workout.id} />
            <Link href="/body/training/library" className="btn btn-ghost">
              Library
            </Link>
          </>
        }
      />

      <Section
        title="Prescriptions"
        meta={`${detail.exercises.length} ${detail.exercises.length === 1 ? "exercise" : "exercises"}${detail.workout.est_minutes ? ` · ~${detail.workout.est_minutes} minutes` : ""}`}
      >
        <Panel>
          <PanelBody className="space-y-6">
            <PrescriptionList rows={detail.exercises} />
            <div className="hairline pt-5">
              <Disclosure label="Add exercise" defaultOpen={detail.exercises.length === 0}>
                <PrescriptionForm workoutId={detail.workout.id} exercises={exercises} />
              </Disclosure>
            </div>
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Workout settings">
        <Disclosure label="Edit workout">
          <WorkoutEditForm workout={detail.workout} />
        </Disclosure>
        <div className="pt-2">
          <DeleteWorkoutButton workoutId={detail.workout.id} />
        </div>
      </Section>
    </div>
  );
}
