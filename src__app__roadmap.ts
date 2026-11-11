export interface RoadmapModule {
  title: string;
  phase: string;
}

export const ROADMAP_MODULES: RoadmapModule[] = [
  { title: 'الحسابات والمنازل', phase: 'P1' },
  { title: 'الأصناف والكتالوج', phase: 'P3' },
  { title: 'حركات المخزون', phase: 'P4' },
  { title: 'التحاليل والروشتات', phase: 'P5' },
  { title: 'العلاجات والرعاية', phase: 'P6' },
  { title: 'المزامنة', phase: 'P7–P8' },
  { title: 'دليل الأطباء والصيدليات', phase: 'P9' },
  { title: 'التقارير والتذكيرات', phase: 'P10' },
  { title: 'المجتمع والتطوير', phase: 'P11' },
  { title: 'النسخ الاحتياطي', phase: 'P12' },
];
