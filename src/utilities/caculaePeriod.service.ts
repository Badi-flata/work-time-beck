import { Modes } from "./types/dashboard-registry.types";
import {format} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Injectable } from "@nestjs/common";
const TZ = 'Asia/Riyadh';
@Injectable()
export class CalculatePeriodService {

  calculateMonthlyBoundedPeriod(
    mode:Modes,
    dateAnchor: string,
    customStartDate?: string,
    customEndDate?: string,
  ) {
    // 1. Get Riyadh date string (yyyy-MM-dd)
    let anchorStr: string;
    if (dateAnchor) {
      anchorStr = dateAnchor; // e.g. "2026-06-02"
    } else {
      anchorStr = format(toZonedTime(Date.now(), TZ), 'yyyy-MM-dd');
    }

    const [year, monthVal, day] = anchorStr.split('-').map(Number);
    const month = monthVal - 1; // 0-indexed month for Date.UTC

    // referenceDateUtc represents the target date at UTC midnight
    const referenceDateUtc = new Date(Date.UTC(year, month, day));

    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    const monthNames = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    const formatArabicDate = (date: Date) => {
      const y = date.getUTCFullYear();
      const m = date.getUTCMonth();
      const d = date.getUTCDate();
      return `${d} ${monthNames[m]} ${y}`;
    };

    if (mode === Modes.DAILY) {
      startDate = referenceDateUtc;
      endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      
      periodLabel = `اليوم: ${formatArabicDate(startDate)}`;
    } else if (mode === Modes.WEEKLY) {
      let startDay: number;
      let endDay: number;
      let weekLabel: string;

      if (day <= 7) {
        startDay = 1; endDay = 7; weekLabel = 'الأسبوع الأول';
      } else if (day <= 14) {
        startDay = 8; endDay = 14; weekLabel = 'الأسبوع الثاني';
      } else if (day <= 21) {
        startDay = 15; endDay = 21; weekLabel = 'الأسبوع الثالث';
      } else if (day <= 28) {
        startDay = 22; endDay = 28; weekLabel = 'الأسبوع الرابع';
      } else {
        startDay = 29;
        const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        endDay = lastDay;
        weekLabel = 'الأسبوع الخامس';
      }

      startDate = new Date(Date.UTC(year, month, startDay));
      endDate = new Date(Date.UTC(year, month, endDay));
      endDate.setUTCDate(endDate.getUTCDate() + 1);

      const formattedStart = formatArabicDate(startDate);
      const formattedEnd = formatArabicDate(new Date(Date.UTC(year, month, endDay)));
      periodLabel = `${weekLabel} (${formattedStart} ↔ ${formattedEnd})`;
    } else if (mode === Modes.MONTHLY) {
      startDate = new Date(Date.UTC(year, month, 1));
      endDate = new Date(Date.UTC(year, month + 1, 1));
      
      const formattedStart = formatArabicDate(startDate);
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const formattedEnd = formatArabicDate(new Date(Date.UTC(year, month, lastDay)));
      periodLabel = `شهر ${monthNames[month]} ${year} (${formattedStart} ↔ ${formattedEnd})`;
    } else {
      // ALL mode
      if (customStartDate) {
        const [sy, sm, sd] = customStartDate.split('-').map(Number);
        startDate = new Date(Date.UTC(sy, sm - 1, sd));
      } else {
        startDate = new Date(referenceDateUtc);
        startDate.setUTCMonth(startDate.getUTCMonth() -3);
      }
      
      if (customEndDate) {
        const [ey, em, ed] = customEndDate.split('-').map(Number);
        endDate = new Date(Date.UTC(ey, em - 1, ed));
        endDate.setUTCDate(endDate.getUTCDate() + 1);
        
        const maxEnd = new Date(startDate);
        maxEnd.setUTCMonth(maxEnd.getUTCMonth() + 5);
        if (endDate > maxEnd) {
          endDate = maxEnd;
        }
      } else {
        endDate = new Date(referenceDateUtc);
        endDate.setUTCDate(endDate.getUTCDate() + 1);
      }

      const formattedStart = formatArabicDate(startDate);
      const formattedEnd = formatArabicDate(new Date(endDate.getTime() - 24 * 60 * 60 * 1000));
      periodLabel = `فترة مخصصة (${formattedStart} ↔ ${formattedEnd})`;
    }

    return { startDate, endDate, periodLabel };
  }
}