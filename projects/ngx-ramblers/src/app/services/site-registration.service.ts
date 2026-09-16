import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { RamblersDirectoryLogo, RegistrationDraft, RegistrationSettings, RegistrationStartRequest, RegistrationStartResponse, SiteRegistration } from "../models/site-registration.model";

@Injectable({providedIn: "root"})
export class SiteRegistrationService {
  private http = inject(HttpClient);
  private base = "api/site-registration";

  availability(): Promise<{enabled: boolean}> {
    return firstValueFrom(this.http.get<{enabled: boolean}>(`${this.base}/availability`));
  }

  directoryLogo(groupName: string, areaName: string): Promise<RamblersDirectoryLogo> {
    return firstValueFrom(this.http.get<RamblersDirectoryLogo>(`${this.base}/logo`, {params: {groupName, areaName}}));
  }

  start(request: RegistrationStartRequest): Promise<RegistrationStartResponse> {
    return firstValueFrom(this.http.post<RegistrationStartResponse>(`${this.base}/start`, request));
  }

  confirm(token: string): Promise<{resumeToken: string}> {
    return firstValueFrom(this.http.post<{resumeToken: string}>(`${this.base}/confirm`, {token}));
  }

  current(token: string): Promise<SiteRegistration> {
    return firstValueFrom(this.http.get<SiteRegistration>(`${this.base}/current`, this.options(token)));
  }

  save(token: string, draft: RegistrationDraft): Promise<SiteRegistration> {
    return firstValueFrom(this.http.put<SiteRegistration>(`${this.base}/current`, draft, this.options(token)));
  }

  discover(token: string, website?: string): Promise<SiteRegistration> {
    return firstValueFrom(this.http.post<SiteRegistration>(`${this.base}/discover`, {website}, this.options(token)));
  }

  submit(token: string): Promise<SiteRegistration> {
    return firstValueFrom(this.http.post<SiteRegistration>(`${this.base}/submit`, {}, this.options(token)));
  }

  retryOwn(token: string): Promise<SiteRegistration> {
    return firstValueFrom(this.http.post<SiteRegistration>(`${this.base}/retry`, {}, this.options(token)));
  }

  list(): Promise<SiteRegistration[]> {
    return firstValueFrom(this.http.get<SiteRegistration[]>(`${this.base}/admin`));
  }

  settings(): Promise<RegistrationSettings> {
    return firstValueFrom(this.http.get<RegistrationSettings>(`${this.base}/admin/settings`));
  }

  saveSettings(settings: RegistrationSettings): Promise<RegistrationSettings> {
    return firstValueFrom(this.http.put<RegistrationSettings>(`${this.base}/admin/settings`, settings));
  }

  approve(id: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.base}/admin/${id}/approve`, {}));
  }

  retry(id: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.base}/admin/${id}/retry`, {}));
  }

  stop(id: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.base}/admin/${id}/stop`, {}));
  }

  broken(id: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.base}/admin/${id}/broken`, {}));
  }

  delete(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.base}/admin/${id}`));
  }

  private options(token: string) {
    return {headers: new HttpHeaders({"x-registration-token": token})};
  }
}
