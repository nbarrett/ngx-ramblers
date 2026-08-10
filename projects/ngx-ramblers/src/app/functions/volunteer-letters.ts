import { VolunteerLetterSeed, VolunteerLetterType } from "../models/volunteer-management.model";

const APPOINTMENT_INTRO = [
  "I am pleased to be writing to you on behalf of {{params.systemMergeFields.APP_LONGNAME}} to confirm your appointment as our {{params.volunteerMergeFields.ROLES}} for the following parishes:",
  "{{params.volunteerMergeFields.PARISH_TABLE}}",
  "The other officers and observers covering the same parishes are:",
  "{{params.volunteerMergeFields.COUNTERPART_TABLE}}",
  "The appointment is open to review at any time to take account of our changing circumstances.",
  "As a footpath volunteer you will be carrying out key activities such as examining proposals for the diversion or extinguishment of paths, additions to the definitive map, and planning applications that affect rights of way. You may also be asked to advise the observers covering your parishes on particular issues, and you may choose to walk some of the paths yourself with a view to monitoring local conditions, dealing with footpath problems and looking for ways of improving your local network.",
  "Ordinarily you will be representing the Ramblers on footpath matters in your area and negotiating on our behalf with local authorities, landowners and other interested parties and user groups.",
  "Your appointment and activities are subject to the area code of practice, which contains the terms and conditions needed to ensure a consistent approach and to protect the Ramblers' interests. By accepting the position you agree to work within those provisions.",
  "This letter and the accompanying code of practice supersede and replace any previous versions.",
  "On behalf of {{params.systemMergeFields.APP_LONGNAME}}, thank you for volunteering to help protect and improve the footpath network."
].join("\n\n");

const AUTHORITY_INTRO = [
  "This letter confirms that {{params.memberMergeFields.FULL_NAME}} is appointed by {{params.systemMergeFields.APP_LONGNAME}} as {{params.volunteerMergeFields.ROLES}} for the following parishes:",
  "{{params.volunteerMergeFields.PARISH_TABLE}}",
  "In this role they represent the Ramblers on public rights of way matters in the parishes listed, including inspecting paths, reporting problems to the local authority, and responding to consultations that affect rights of way.",
  "This authority remains in place until it is withdrawn or replaced, and supersedes any previous versions."
].join("\n\n");

const LETTER_SEEDS: VolunteerLetterSeed[] = [
  {
    letterType: VolunteerLetterType.APPOINTMENT,
    title: "Appointment letter",
    description: "Confirms a volunteer's appointment, with their parishes and counterpart officers",
    subject: "Your appointment as {{params.volunteerMergeFields.ROLES}}",
    introMarkdown: APPOINTMENT_INTRO
  },
  {
    letterType: VolunteerLetterType.AUTHORITY,
    title: "Letter of authority",
    description: "Confirms the authority a volunteer carries for the parishes they cover",
    subject: "Letter of authority: {{params.volunteerMergeFields.ROLES}}",
    introMarkdown: AUTHORITY_INTRO
  }
];

export function volunteerLetterSeeds(): VolunteerLetterSeed[] {
  return LETTER_SEEDS;
}

export function volunteerLetterSeed(letterType: string | null | undefined): VolunteerLetterSeed | null {
  return LETTER_SEEDS.find(seed => seed.letterType === letterType) ?? null;
}
