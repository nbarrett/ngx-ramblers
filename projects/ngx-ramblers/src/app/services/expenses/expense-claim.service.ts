import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { ExpenseClaim, ExpenseClaimApiResponse } from "../../notifications/expenses/expense.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class ExpenseClaimService {
  private logger: Logger = inject(LoggerFactory).createLogger("ExpenseClaimService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "/api/database/expense-claim";
  private expenseNotifications = new Subject<ExpenseClaimApiResponse>();

  notifications(): Observable<ExpenseClaimApiResponse> {
    return this.expenseNotifications.asObservable();
  }

  all(dataQueryOptions?: DataQueryOptions): void {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("all:dataQueryOptions", dataQueryOptions, "params", params.toString());
    this.commonDataService.responseFrom(this.logger, this.http.get<ExpenseClaimApiResponse>(`${this.BASE_URL}/all`, {params}), this.expenseNotifications);
  }

  async createOrUpdate(expense: ExpenseClaim): Promise<ExpenseClaim> {
    if (expense.id) {
      return this.update(expense);
    } else {
      return this.create(expense);
    }
  }

  getById(expenseId: string): void {
    this.logger.debug("getById:", expenseId);
    this.commonDataService.responseFrom(this.logger, this.http.get<ExpenseClaimApiResponse>(`${this.BASE_URL}/${expenseId}`), this.expenseNotifications);
  }

  async update(expense: ExpenseClaim): Promise<ExpenseClaim> {
    this.logger.debug("updating", expense);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.put<ExpenseClaimApiResponse>(this.BASE_URL + "/" + expense.id, expense), this.expenseNotifications);
    this.logger.debug("updated", expense, "- received", apiResponse);
    return apiResponse.response as ExpenseClaim;
  }

  async create(expenseClaim: ExpenseClaim): Promise<ExpenseClaim> {
    this.logger.debug("creating", expenseClaim);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<ExpenseClaimApiResponse>(this.BASE_URL, expenseClaim), this.expenseNotifications);
    this.logger.debug("created", expenseClaim, "- received", apiResponse);
    return apiResponse.response as ExpenseClaim;
  }

  async delete(expense: ExpenseClaim): Promise<ExpenseClaim> {
    this.logger.debug("deleting", expense);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.delete<ExpenseClaimApiResponse>(this.BASE_URL + "/" + expense.id), this.expenseNotifications);
    this.logger.debug("deleted", expense, "- received", apiResponse);
    return apiResponse.response as ExpenseClaim;
  }

}
