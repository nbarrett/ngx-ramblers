import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { isString } from "es-toolkit/compat";
import { chain } from "../../functions/chain";
import { DataQueryOptions } from "../../models/api-request.model";
import { Identifiable } from "../../models/api-response.model";
import { MailchimpSubscription } from "../../models/mailchimp.model";
import {
  DeleteDocumentsRequest,
  Member,
  MemberApiResponse,
  MemberFilterSelection,
  MemberPrivileges
} from "../../models/member.model";
import { CommonDataService } from "../common-data-service";
import { DbUtilsService } from "../db-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { NumberUtilsService } from "../number-utils.service";
import { DeletionResponse, DeletionResponseApiResponse } from "../../models/mongo-models";

@Injectable({
  providedIn: "root"
})
export class MemberService {

  private logger: Logger = inject(LoggerFactory).createLogger("MemberService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private numberUtils = inject(NumberUtilsService);
  private dbUtils = inject(DbUtilsService);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "/api/database/member";
  private memberChanges = new Subject<MemberApiResponse>();
  private memberDeletions = new Subject<DeletionResponseApiResponse>();

  filterFor = {
    GROUP_MEMBERS: (member: Member) => member.groupMember,
    COMMITTEE_MEMBERS: (member: Member) => member.groupMember && member.committee,
    SOCIAL_MEMBERS: (member: Member) => member.groupMember && member.socialMember,
  };

  publicFieldsDataQueryOptions: DataQueryOptions = {
    select: {
      committee: 1,
      contactId: 1,
      displayName: 1,
      email: 1,
      fileAdmin: 1,
      financeAdmin: 1,
      firstName: 1,
      groupMember: 1,
      id: 1,
      lastName: 1,
      mail: 1,
      mailchimpLists: 1,
      mobileNumber: 1,
      nameAlias: 1,
      socialMember: 1,
      treasuryAdmin: 1,
      walkChangeNotifications: 1,
    }
  };

  changeNotifications(): Observable<MemberApiResponse> {
    return this.memberChanges.asObservable();
  }

  deletionNotifications(): Observable<DeletionResponseApiResponse> {
    return this.memberDeletions.asObservable();
  }

  getMemberForUserName(userName: string): Promise<Member> {
    return this.query({criteria: {userName: userName.toLowerCase()}});
  }

  async query(dataQueryOptions?: DataQueryOptions): Promise<Member> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("find-one:criteria", dataQueryOptions, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<MemberApiResponse>(`${this.BASE_URL}/find-one`, {params}), this.memberChanges);
    this.logger.debug("find-one:received", apiResponse);
    return apiResponse.response as Member;
  }

  async all(dataQueryOptions?: DataQueryOptions): Promise<Member[]> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("all:params", params.toString());
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<MemberApiResponse>(`${this.BASE_URL}/all`, {params}), this.memberChanges);
    const responses = response.response as Member[];
    this.logger.debug("all:params", params.toString(), "received", responses.length, "members");
    return responses;
  }

  async getById(memberId: string): Promise<Member> {
    this.logger.debug("getById:", memberId);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<MemberApiResponse>(`${this.BASE_URL}/${memberId}`), this.memberChanges);
    this.logger.debug("getById - received", apiResponse);
    return apiResponse.response as Member;
  }

  async getMemberByPasswordResetId(passwordResetId): Promise<Member> {
    this.logger.debug("getMemberByPasswordResetId:", passwordResetId);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<MemberApiResponse>(`${this.BASE_URL}/password-reset-id/${passwordResetId}`), this.memberChanges);
    this.logger.debug("getMemberByPasswordResetId - received", apiResponse);
    return apiResponse.response as Member;
  }

  async create(member: Member): Promise<Member> {
    this.logger.debug("create:requested:", member);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<MemberApiResponse>(this.BASE_URL, this.dbUtils.performAudit(member)), this.memberChanges);
    this.logger.debug("created:received:", apiResponse);
    return apiResponse.response as Member;
  }

  async update(member: Member): Promise<Member> {
    this.logger.debug("updating", member);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.put<MemberApiResponse>(this.BASE_URL + "/" + member.id, this.dbUtils.performAudit(member)), this.memberChanges);
    this.logger.debug("updated", member, "- received", apiResponse);
    return apiResponse.response as Member;
  }

  async updateMailSubscription(memberId: string, listType: string, subscription: MailchimpSubscription): Promise<Member> {
    const body: any = {mailchimpLists: {}};
    body.mailchimpLists[listType] = subscription;
    this.logger.debug("updating member id", memberId, listType, "subscription:", body);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.put<MemberApiResponse>(`${this.BASE_URL}/${memberId}/email-subscription`, body), this.memberChanges);
    this.logger.debug("updated member id", memberId, listType, "subscription:", body, "response:", apiResponse);
    return apiResponse.response as Member;
  }

  async delete(member: Member): Promise<DeletionResponse> {
    this.logger.debug("deleting", member);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.delete<DeletionResponseApiResponse>(this.BASE_URL + "/" + member.id), this.memberDeletions);
    this.logger.debug("deleted", member, "- received", apiResponse);
    return apiResponse.response as DeletionResponse;
  }

  async deleteAll(members: Member[]): Promise<DeletionResponse[]> {
    this.logger.debug("deleteAll:requested:", members);
    const deleteMembersRequest: DeleteDocumentsRequest = {ids: members.map((member: Member) => member.id)};
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<DeletionResponseApiResponse>(this.BASE_URL + "/delete-all", deleteMembersRequest), this.memberDeletions);
    this.logger.debug("deleteAll:received:", apiResponse);
    return apiResponse.response as DeletionResponse[];
  }

  setPasswordResetId(member: Member) {
    member.passwordResetId = this.numberUtils.generateUid();
    this.logger.debug("member.userName", member.userName, "member.passwordResetId", member.passwordResetId);
    return member;
  }

  async createOrUpdate(member: Member): Promise<Member> {
    if (member.id) {
      return this.update(member);
    } else {
      return this.create(member);
    }
  }

  async createOrUpdateAll(members: Member[]): Promise<Member[]> {
    const auditedMembers: Member[] = members.map((member: Member) => this.dbUtils.performAudit(member));
    this.logger.info("createOrUpdateAll:requested", members);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<MemberApiResponse>(`${this.BASE_URL}/all`, auditedMembers), this.memberChanges);
    this.logger.info("createOrUpdateAll:received", apiResponse);
    return apiResponse.response as Member[];
  }

  extractMemberId(memberIdOrObject: any): string {
    return memberIdOrObject?.id ?? memberIdOrObject;
  }

  publicFields(filterFunction?: (value?: any) => boolean): Promise<Member[]> {
    return this.all(this.publicFieldsDataQueryOptions).then(members => chain(members)
      .filter(filterFunction || (() => true))
      .sortBy((member: Member) => member.firstName + member.lastName).value());
  }

  toMember(memberIdOrObject: any, members: Member[]): Member {
    const memberId = this.extractMemberId(memberIdOrObject);
    return members?.find((member: Member) => this.extractMemberId(member) === memberId);
  }

  allMemberMembersWithPrivilege(privilege: keyof MemberPrivileges, members: Member[]): Member[] {
    const filteredMembers = members.filter((member: Member) => member.groupMember && member[privilege]);
    this.logger.debug("allMemberMembersWithPrivilege:privilege", privilege, "filtered from", members.length, "->", filteredMembers.length, "members ->", filteredMembers);
    return filteredMembers;
  }

  allMemberIdsWithPrivilege(privilege: keyof MemberPrivileges, members: Member[]): string[] {
    return this.allMemberMembersWithPrivilege(privilege, members).map((member: Member) => member.id);
  }

  toIdentifiable(member: MemberFilterSelection | Member | string): Identifiable {
    return isString(member) ? {id: member} : {id: member.id};
  }


}
