#import <AppSpecs/AppSpecs.h>
#import <Foundation/Foundation.h>
#import <React/RCTInvalidating.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>
// A fábrica do React Native (pod React-RCTAppDelegate), para a categoria do fim do arquivo.
#if __has_include(<React-RCTAppDelegate/RCTReactNativeFactory.h>)
#import <React-RCTAppDelegate/RCTReactNativeFactory.h>
#elif __has_include(<React_RCTAppDelegate/RCTReactNativeFactory.h>)
#import <React_RCTAppDelegate/RCTReactNativeFactory.h>
#else
#import <RCTReactNativeFactory.h>
#endif

/**
 * O que o módulo usa da `LaunchCenter` (Swift, `LaunchCenter.swift`), lida
 * pelo nome em tempo de execução para não depender do cabeçalho gerado.
 */
@protocol AOLaunchCenterAPI <NSObject>
@property (nonatomic, copy, nullable) void (^onTarget)(void);
- (void)open:(NSString *)target;
- (nullable NSString *)consume;
@end

static id<AOLaunchCenterAPI> SharedLaunchCenter(void)
{
  return [NSClassFromString(@"AOLaunchCenter") valueForKey:@"shared"];
}

/**
 * O que o módulo usa da `BackgroundCheck` (Swift, `AppDelegate.swift`): os
 * pedidos ao BGTaskScheduler e as rodadas em segundo plano. Lida pelo nome,
 * como a `LaunchCenter`; os seletores são os `@objc(...)` de lá.
 */
@protocol AOBackgroundCheckAPI <NSObject>
- (void)setPortalCheck:(BOOL)enabled intervalHours:(double)intervalHours;
- (void)setReturnWatch:(BOOL)enabled;
/** Cada bloco diz se o evento saiu; sem ele, a rodada espera o próximo módulo. */
- (void)listen:(BOOL (^)(NSDictionary *round))deliver expire:(BOOL (^)(NSString *roundId))expire;
- (void)complete:(NSString *)roundId success:(BOOL)success;
@end

static id<AOBackgroundCheckAPI> SharedBackgroundCheck(void)
{
  return [NSClassFromString(@"AOBackgroundCheck") valueForKey:@"shared"];
}

/** Lembretes de aula: prefixo dos ids, para trocá-los sem tocar nos outros avisos. */
static NSString *const kReminderPrefix = @"class:";
/** Os semanais ("class:weekly:<lembrete>"), que se repetem até o app tirar. */
static NSString *const kWeeklyPrefix = @"class:weekly:";
/** A validade dos semanais (segundos desde 1970): o iOS não sabe pará-los sozinho. */
static NSString *const kWeeklyExpiresKey = @"ao.classReminders.weeklyExpiresAt";
/**
 * O iOS guarda só os 64 avisos agendados mais próximos: os lembretes usam até
 * 60 e deixam folga para os outros. As avaliações vêm primeiro (até 20); as
 * aulas ficam com o resto, todos os 60 para quem não anotou nenhuma.
 */
static const NSUInteger kMaxScheduled = 60;
/**
 * Avisos da Companhia agora: "companion:<lembrete>", nos 4 lugares que os
 * lembretes deixam livres (no máximo dois por chamada, poucas de uma vez).
 */
static NSString *const kCompanionPrefix = @"companion:";
static const NSUInteger kMaxCompanionReminders = 4;
/** Lembretes das avaliações: "evaluation:<avaliação>:<lembrete>". */
static NSString *const kEvaluationPrefix = @"evaluation:";
static const NSUInteger kMaxEvaluationReminders = 20;
/** Categoria com o texto da tela bloqueada quando o aparelho esconde o conteúdo. */
static NSString *const kPrivateCategory = @"ao-private";
/** Avisos de trabalhos: a mesma, com o botão "Já fiz" (tratado na `LaunchCenter.swift`). */
static NSString *const kEvaluationCategory = @"ao-evaluation";
/** Os mesmos nomes de `EvaluationDone` na `LaunchCenter.swift`. */
static NSString *const kDoneAction = @"evaluation-done";
static NSString *const kDoneKey = @"ao.evaluations.done";

/**
 * Um número do JSON vindo do JS, ou `fallback`. O JS manda números, mas uma
 * data inválida vira `null` no `JSON.stringify`, e `[NSNull doubleValue]`
 * derruba o app ("unrecognized selector").
 */
static double AONumber(id value, double fallback)
{
  return [value isKindOfClass:[NSNumber class]] ? [value doubleValue] : fallback;
}

/**
 * Tira os lembretes semanais de aula depois da validade (21 dias sem ler a
 * grade): um aviso que se repete não para sozinho. Roda sempre que o JS
 * começa (a abertura do app e as rodadas em segundo plano).
 */
static void CancelExpiredWeeklyReminders(void)
{
  NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
  NSTimeInterval expiresAt = [defaults doubleForKey:kWeeklyExpiresKey];
  if (expiresAt <= 0 || [NSDate date].timeIntervalSince1970 <= expiresAt) {
    return;
  }
  [defaults removeObjectForKey:kWeeklyExpiresKey];
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center getPendingNotificationRequestsWithCompletionHandler:^(NSArray<UNNotificationRequest *> *requests) {
    NSMutableArray<NSString *> *weekly = [NSMutableArray array];
    for (UNNotificationRequest *request in requests) {
      if ([request.identifier hasPrefix:kWeeklyPrefix]) {
        [weekly addObject:request.identifier];
      }
    }
    [center removePendingNotificationRequestsWithIdentifiers:weekly];
  }];
}

/** O texto de um lembrete de aula (o mesmo nos de data única e nos semanais). */
static UNMutableNotificationContent *ClassReminderContent(NSDictionary *item)
{
  UNMutableNotificationContent *content = [UNMutableNotificationContent new];
  content.title = [item[@"title"] isKindOfClass:[NSString class]] ? item[@"title"] : @"Aula em breve";
  content.body = [item[@"body"] isKindOfClass:[NSString class]] ? item[@"body"] : @"";
  content.sound = [UNNotificationSound defaultSound];
  content.threadIdentifier = @"class-reminders";
  content.categoryIdentifier = kPrivateCategory;
  content.userInfo = @{@"target" : @"home"};
  return content;
}

/**
 * Avisos para o JS (spec: src/specs/NativeAppNotifications.ts), como o
 * AppNotificationsModule.kt do Android, nos limites do iOS: lembretes de
 * aula agendados como avisos de data única até `expiresAt` (semanais quando
 * não cabem), lembretes das avaliações (até 20 dos 60 lugares, um grupo por
 * avaliação, com o "Já fiz" nos trabalhos),
 * avisos na hora e as aberturas pelo toque. A verificação no portal e
 * "Avisar quando voltar" vão ao BGTaskScheduler (`BackgroundCheck`, no
 * AppDelegate.swift), que entrega as rodadas ao JS pelos eventos
 * `onBackgroundTask` e `onBackgroundTaskExpired`. As leituras a cada 15
 * minutos (`setCompanionWatch` e `setCampusWatch`) não fazem nada: o iOS não
 * acorda o app com essa frequência.
 */
@interface AppNotificationsModule : NativeAppNotificationsSpecBase <NativeAppNotificationsSpec, RCTInvalidating>
@end

/** O módulo da sessão atual do JS (um reload cria outro). */
static __weak AppNotificationsModule *gCurrentModule;

@implementation AppNotificationsModule

+ (NSString *)moduleName
{
  return @"AppNotifications";
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeAppNotificationsSpecJSI>(params);
}

- (instancetype)init
{
  if (self = [super init]) {
    UNNotificationCategory *category =
        [UNNotificationCategory categoryWithIdentifier:kPrivateCategory
                                               actions:@[]
                                     intentIdentifiers:@[]
                         hiddenPreviewsBodyPlaceholder:@"Toque para ver no AO UERJ."
                                               options:UNNotificationCategoryOptionNone];
    // "Já fiz" roda sem abrir o app
    UNNotificationAction *done = [UNNotificationAction actionWithIdentifier:kDoneAction
                                                                      title:@"Já fiz"
                                                                    options:UNNotificationActionOptionNone];
    UNNotificationCategory *evaluation =
        [UNNotificationCategory categoryWithIdentifier:kEvaluationCategory
                                               actions:@[ done ]
                                     intentIdentifiers:@[]
                         hiddenPreviewsBodyPlaceholder:@"Toque para ver no AO UERJ."
                                               options:UNNotificationCategoryOptionNone];
    [[UNUserNotificationCenter currentNotificationCenter]
        setNotificationCategories:[NSSet setWithObjects:category, evaluation, nil]];
    // os lembretes semanais vencidos saem antes de qualquer plano novo
    CancelExpiredWeeklyReminders();
    // um toque com o app em memória vira o evento; o destino sai em consumeLaunchTarget
    gCurrentModule = self;
    SharedLaunchCenter().onTarget = ^{
      [gCurrentModule emitOpenTarget];
    };
  }
  return self;
}

- (void)invalidate
{
  if (gCurrentModule == self) {
    gCurrentModule = nil;
  }
}

// Só emite depois que o JS assinou o evento (antes disso, o callback não existe).
- (void)emitOpenTarget
{
  if (_eventEmitterCallback) {
    [self emitOnOpenTarget:@"open"];
  }
}

/**
 * Uma rodada em segundo plano para o JS (`{id, modes}`). `NO` se este
 * módulo já saiu (reload) ou ainda não tem o callback: a rodada espera.
 */
- (BOOL)emitBackgroundRound:(NSDictionary *)round
{
  if (gCurrentModule != self || !_eventEmitterCallback) {
    return NO;
  }
  [self emitOnBackgroundTask:round];
  return YES;
}

- (BOOL)emitBackgroundRoundExpired:(NSString *)roundId
{
  if (gCurrentModule != self || !_eventEmitterCallback) {
    return NO;
  }
  [self emitOnBackgroundTaskExpired:roundId];
  return YES;
}

#pragma mark - Permissão e configurações

static BOOL IsAuthorized(UNAuthorizationStatus status)
{
  return status == UNAuthorizationStatusAuthorized || status == UNAuthorizationStatusProvisional ||
      status == UNAuthorizationStatusEphemeral;
}

- (void)areNotificationsEnabled:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [[UNUserNotificationCenter currentNotificationCenter]
      getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
        resolve(@(IsAuthorized(settings.authorizationStatus)));
      }];
}

// "granted", ou "blocked": o iOS só pergunta uma vez, depois só os Ajustes liberam.
- (void)requestPermission:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
    if (settings.authorizationStatus != UNAuthorizationStatusNotDetermined) {
      resolve(IsAuthorized(settings.authorizationStatus) ? @"granted" : @"blocked");
      return;
    }
    [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound)
                          completionHandler:^(BOOL granted, NSError *error) {
                            resolve(granted ? @"granted" : @"blocked");
                          }];
  }];
}

- (void)openNotificationSettings:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSString *address = UIApplicationOpenSettingsURLString;
    if (@available(iOS 16.0, *)) {
      address = UIApplicationOpenNotificationSettingsURLString;
    }
    [[UIApplication sharedApplication] openURL:[NSURL URLWithString:address]
                                       options:@{}
                             completionHandler:^(BOOL success) {
                               resolve(nil);
                             }];
  });
}

// O iOS entrega os avisos agendados no horário: não há "Alarmes e lembretes".
- (void)canScheduleExactAlarms:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(@YES);
}

- (void)openExactAlarmSettings:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(nil);
}

#pragma mark - Lembretes de aula

- (void)setClassReminders:(NSString *)plan
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  NSDictionary *parsed = nil;
  if (plan.length > 0) {
    id json = [NSJSONSerialization JSONObjectWithData:[plan dataUsingEncoding:NSUTF8StringEncoding]
                                              options:0
                                                error:nil];
    if (![json isKindOfClass:[NSDictionary class]] || ![json[@"reminders"] isKindOfClass:[NSArray class]]) {
      reject(@"E_REMINDERS", @"malformed reminder plan", nil);
      return;
    }
    parsed = json;
  }
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center getPendingNotificationRequestsWithCompletionHandler:^(NSArray<UNNotificationRequest *> *requests) {
    NSMutableArray<NSString *> *old = [NSMutableArray array];
    NSUInteger evaluations = 0;
    for (UNNotificationRequest *request in requests) {
      if ([request.identifier hasPrefix:kReminderPrefix]) {
        [old addObject:request.identifier];
      } else if ([request.identifier hasPrefix:kEvaluationPrefix]) {
        evaluations++;
      }
    }
    [center removePendingNotificationRequestsWithIdentifiers:old];
    if (parsed) {
      // os lugares que as avaliações não usam ficam para as aulas
      [self schedule:parsed center:center limit:kMaxScheduled - MIN(evaluations, kMaxEvaluationReminders)];
    }
    resolve(nil);
  }];
}

/**
 * Cada lembrete (1 = segunda … 7 = domingo, minutos desde 0h) nas datas de
 * agora até `expiresAt` (21 dias depois da leitura da grade), os mais
 * próximos primeiro, no máximo `limit`. Avisos de data única param sozinhos
 * na validade, como os alarmes do Android. Quando não cabem (muitas aulas e
 * provas), cada horário vira um aviso semanal (`scheduleWeekly`).
 */
- (void)schedule:(NSDictionary *)plan center:(UNUserNotificationCenter *)center limit:(NSUInteger)limit
{
  NSCalendar *calendar = [NSCalendar currentCalendar];
  NSDate *now = [NSDate date];
  NSTimeInterval expiresAt = AONumber(plan[@"expiresAt"], 0) / 1000.0;
  NSDate *today = [calendar startOfDayForDate:now];
  NSMutableArray<NSDictionary *> *occurrences = [NSMutableArray array];
  NSMutableArray<NSDictionary *> *slots = [NSMutableArray array];
  for (id item in plan[@"reminders"]) {
    if (![item isKindOfClass:[NSDictionary class]]) {
      continue;
    }
    NSInteger weekday = (NSInteger)AONumber(item[@"weekday"], -1);
    NSInteger minutes = (NSInteger)AONumber(item[@"minutes"], -1);
    NSString *identifier = [item[@"id"] isKindOfClass:[NSString class]] ? item[@"id"] : nil;
    if (weekday < 1 || weekday > 7 || minutes < 0 || minutes >= 24 * 60 || !identifier) {
      continue;
    }
    // NSCalendar: 1 = domingo … 7 = sábado
    NSInteger calendarWeekday = weekday % 7 + 1;
    [slots addObject:@{@"item" : item, @"id" : identifier, @"weekday" : @(calendarWeekday), @"minutes" : @(minutes)}];
    for (NSInteger offset = 0; offset <= 31; offset++) {
      NSDate *day = [calendar dateByAddingUnit:NSCalendarUnitDay value:offset toDate:today options:0];
      if (!day || day.timeIntervalSince1970 > expiresAt) {
        break;
      }
      if ([calendar component:NSCalendarUnitWeekday fromDate:day] != calendarWeekday) {
        continue;
      }
      NSDate *fire = [calendar dateBySettingHour:minutes / 60 minute:minutes % 60 second:0 ofDate:day options:0];
      if (!fire || [fire compare:now] != NSOrderedDescending || fire.timeIntervalSince1970 > expiresAt) {
        continue;
      }
      [occurrences addObject:@{@"date" : fire, @"item" : item, @"id" : identifier}];
    }
  }
  [occurrences sortUsingComparator:^NSComparisonResult(NSDictionary *a, NSDictionary *b) {
    return [a[@"date"] compare:b[@"date"]];
  }];
  // as datas não cabem, mas um aviso por horário cabe: os semanais
  if (occurrences.count > limit && slots.count > 0 && slots.count <= limit) {
    [self scheduleWeekly:slots expiresAt:expiresAt center:center];
    return;
  }
  [[NSUserDefaults standardUserDefaults] removeObjectForKey:kWeeklyExpiresKey];
  NSUInteger count = MIN(occurrences.count, limit);
  for (NSUInteger index = 0; index < count; index++) {
    NSDictionary *occurrence = occurrences[index];
    NSDictionary *item = occurrence[@"item"];
    NSDate *date = occurrence[@"date"];
    UNMutableNotificationContent *content = ClassReminderContent(item);
    NSDateComponents *components =
        [calendar components:(NSCalendarUnitYear | NSCalendarUnitMonth | NSCalendarUnitDay | NSCalendarUnitHour |
                              NSCalendarUnitMinute)
                    fromDate:date];
    UNCalendarNotificationTrigger *trigger = [UNCalendarNotificationTrigger triggerWithDateMatchingComponents:components
                                                                                                     repeats:NO];
    NSString *requestId =
        [NSString stringWithFormat:@"%@%@@%.0f", kReminderPrefix, occurrence[@"id"], date.timeIntervalSince1970];
    [center addNotificationRequest:[UNNotificationRequest requestWithIdentifier:requestId
                                                                        content:content
                                                                        trigger:trigger]
             withCompletionHandler:nil];
  }
}

/**
 * Um aviso por horário de aula que se repete toda semana, como os alarmes
 * do Android: uma grade de 12 tempos usa 12 lugares, e não dezenas. Só
 * quando os de data única não cabem, porque um aviso que se repete não para
 * na validade: ela fica guardada, e `CancelExpiredWeeklyReminders` os tira
 * quando o app roda depois dela. Sem o app rodar nesse tempo, eles seguem
 * até a próxima abertura.
 */
- (void)scheduleWeekly:(NSArray<NSDictionary *> *)slots
             expiresAt:(NSTimeInterval)expiresAt
                center:(UNUserNotificationCenter *)center
{
  [[NSUserDefaults standardUserDefaults] setDouble:expiresAt forKey:kWeeklyExpiresKey];
  for (NSDictionary *slot in slots) {
    NSInteger minutes = [slot[@"minutes"] integerValue];
    NSDateComponents *components = [NSDateComponents new];
    components.weekday = [slot[@"weekday"] integerValue];
    components.hour = minutes / 60;
    components.minute = minutes % 60;
    UNCalendarNotificationTrigger *trigger = [UNCalendarNotificationTrigger triggerWithDateMatchingComponents:components
                                                                                                     repeats:YES];
    NSString *requestId = [NSString stringWithFormat:@"%@%@", kWeeklyPrefix, slot[@"id"]];
    [center addNotificationRequest:[UNNotificationRequest requestWithIdentifier:requestId
                                                                        content:ClassReminderContent(slot[@"item"])
                                                                        trigger:trigger]
             withCompletionHandler:nil];
  }
}

#pragma mark - Lembretes de avaliações

- (void)setEvaluationReminders:(NSString *)plan
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  NSArray *reminders = @[];
  if (plan.length > 0) {
    id json = [NSJSONSerialization JSONObjectWithData:[plan dataUsingEncoding:NSUTF8StringEncoding]
                                              options:0
                                                error:nil];
    if (![json isKindOfClass:[NSDictionary class]] || ![json[@"reminders"] isKindOfClass:[NSArray class]]) {
      reject(@"E_EVALUATIONS", @"malformed evaluation reminder plan", nil);
      return;
    }
    reminders = json[@"reminders"];
  }
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center getPendingNotificationRequestsWithCompletionHandler:^(NSArray<UNNotificationRequest *> *requests) {
    NSMutableArray<NSString *> *old = [NSMutableArray array];
    for (UNNotificationRequest *request in requests) {
      if ([request.identifier hasPrefix:kEvaluationPrefix]) {
        [old addObject:request.identifier];
      }
    }
    [center removePendingNotificationRequestsWithIdentifiers:old];
    NSUInteger added = [self scheduleEvaluations:reminders center:center];
    [self makeRoomFor:added requests:requests center:center];
    [self collapseDeliveredEvaluations:center];
    resolve(nil);
  }];
}

/**
 * Um aviso por avaliação, como no Android: dos lembretes já mostrados de uma
 * mesma avaliação, só o mais recente fica na Central de Notificações. O iOS
 * não troca um aviso local pelo seguinte quando ele aparece, então o app faz
 * isso quando roda (na abertura e nas rodadas em segundo plano, que mandam o
 * plano das avaliações). Enquanto isso, o grupo de cada avaliação
 * (`threadIdentifier`) já os empilha.
 */
- (void)collapseDeliveredEvaluations:(UNUserNotificationCenter *)center
{
  [center getDeliveredNotificationsWithCompletionHandler:^(NSArray<UNNotification *> *delivered) {
    NSMutableDictionary<NSString *, UNNotification *> *latest = [NSMutableDictionary dictionary];
    NSMutableArray<NSString *> *older = [NSMutableArray array];
    for (UNNotification *notification in delivered) {
      NSString *identifier = notification.request.identifier;
      id evaluation = notification.request.content.userInfo[@"evaluationId"];
      if (![identifier hasPrefix:kEvaluationPrefix] || ![evaluation isKindOfClass:[NSString class]]) {
        continue;
      }
      UNNotification *kept = latest[evaluation];
      if (!kept) {
        latest[evaluation] = notification;
      } else if ([notification.date compare:kept.date] == NSOrderedDescending) {
        [older addObject:kept.request.identifier];
        latest[evaluation] = notification;
      } else {
        [older addObject:identifier];
      }
    }
    if (older.count > 0) {
      [center removeDeliveredNotificationsWithIdentifiers:older];
    }
  }];
}

/**
 * As avaliações vêm primeiro: com elas, os lembretes de aula mais distantes
 * saem até caber nos 60 lugares. Eles voltam quando o plano das aulas for
 * enviado de novo (a cada leitura da grade).
 */
- (void)makeRoomFor:(NSUInteger)evaluations
           requests:(NSArray<UNNotificationRequest *> *)requests
             center:(UNUserNotificationCenter *)center
{
  NSMutableArray<UNNotificationRequest *> *classes = [NSMutableArray array];
  for (UNNotificationRequest *request in requests) {
    if ([request.identifier hasPrefix:kReminderPrefix]) {
      [classes addObject:request];
    }
  }
  if (classes.count + evaluations <= kMaxScheduled) {
    return;
  }
  NSUInteger overflow = classes.count + evaluations - kMaxScheduled;
  [classes sortUsingComparator:^NSComparisonResult(UNNotificationRequest *a, UNNotificationRequest *b) {
    NSDate *first = [a.trigger isKindOfClass:[UNCalendarNotificationTrigger class]]
                        ? [(UNCalendarNotificationTrigger *)a.trigger nextTriggerDate]
                        : nil;
    NSDate *second = [b.trigger isKindOfClass:[UNCalendarNotificationTrigger class]]
                         ? [(UNCalendarNotificationTrigger *)b.trigger nextTriggerDate]
                         : nil;
    // os mais distantes primeiro
    return [(second ?: [NSDate distantFuture]) compare:(first ?: [NSDate distantFuture])];
  }];
  NSMutableArray<NSString *> *farthest = [NSMutableArray array];
  for (NSUInteger index = 0; index < overflow && index < classes.count; index++) {
    [farthest addObject:classes[index].identifier];
  }
  [center removePendingNotificationRequestsWithIdentifiers:farthest];
}

/**
 * Cada lembrete é um aviso de data única, os mais próximos primeiro (no
 * máximo 20), no grupo da avaliação. Os que já passaram, os de avaliações já
 * começadas e os das marcadas com "Já fiz" (ainda não lidas pelo JS) ficam de
 * fora. Devolve quantos agendou.
 */
- (NSUInteger)scheduleEvaluations:(NSArray *)reminders center:(UNUserNotificationCenter *)center
{
  NSCalendar *calendar = [NSCalendar currentCalendar];
  NSTimeInterval now = [NSDate date].timeIntervalSince1970;
  NSArray<NSString *> *done = [[NSUserDefaults standardUserDefaults] stringArrayForKey:kDoneKey] ?: @[];
  NSMutableArray<NSDictionary *> *upcoming = [NSMutableArray array];
  for (id item in reminders) {
    if (![item isKindOfClass:[NSDictionary class]] || ![item[@"id"] isKindOfClass:[NSString class]] ||
        ![item[@"evaluationId"] isKindOfClass:[NSString class]] || ![item[@"title"] isKindOfClass:[NSString class]]) {
      continue;
    }
    NSTimeInterval at = AONumber(item[@"at"], 0) / 1000.0;
    NSTimeInterval until = AONumber(item[@"until"], 0) / 1000.0;
    if (at <= now || until <= now || [done containsObject:item[@"evaluationId"]]) {
      continue;
    }
    [upcoming addObject:item];
  }
  [upcoming sortUsingComparator:^NSComparisonResult(NSDictionary *a, NSDictionary *b) {
    return [a[@"at"] compare:b[@"at"]];
  }];
  NSUInteger count = MIN(upcoming.count, kMaxEvaluationReminders);
  for (NSUInteger index = 0; index < count; index++) {
    NSDictionary *item = upcoming[index];
    NSString *evaluation = item[@"evaluationId"];
    UNMutableNotificationContent *content = [UNMutableNotificationContent new];
    content.title = item[@"title"];
    content.body = [item[@"body"] isKindOfClass:[NSString class]] ? item[@"body"] : @"";
    content.sound = [UNNotificationSound defaultSound];
    // um grupo por avaliação: "Em 3 dias", "Amanhã" e "Hoje" da mesma prova
    // ficam empilhados, e não soltos entre os outros avisos
    content.threadIdentifier = [NSString stringWithFormat:@"%@%@", kEvaluationPrefix, evaluation];
    content.categoryIdentifier = AONumber(item[@"completable"], 0) != 0 ? kEvaluationCategory : kPrivateCategory;
    content.userInfo = @{@"target" : @"home", @"evaluationId" : evaluation};
    NSDate *date = [NSDate dateWithTimeIntervalSince1970:AONumber(item[@"at"], 0) / 1000.0];
    NSDateComponents *components =
        [calendar components:(NSCalendarUnitYear | NSCalendarUnitMonth | NSCalendarUnitDay | NSCalendarUnitHour |
                              NSCalendarUnitMinute)
                    fromDate:date];
    UNCalendarNotificationTrigger *trigger = [UNCalendarNotificationTrigger triggerWithDateMatchingComponents:components
                                                                                                     repeats:NO];
    // "evaluation:<avaliação>:<lembrete>": o "Já fiz" tira os da mesma avaliação pelo prefixo
    NSString *requestId = [NSString stringWithFormat:@"%@%@:%@", kEvaluationPrefix, evaluation, item[@"id"]];
    [center addNotificationRequest:[UNNotificationRequest requestWithIdentifier:requestId
                                                                        content:content
                                                                        trigger:trigger]
             withCompletionHandler:nil];
  }
  return count;
}

#pragma mark - Avisos da Companhia agora

/**
 * Substitui os avisos da Companhia agora: cada um é um aviso de data única,
 * os mais próximos primeiro. Os que já passaram ficam de fora (o iOS não
 * guarda quais já apareceram, então um aviso atrasado não é mostrado).
 */
- (void)setCompanionReminders:(NSString *)plan
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  NSArray *reminders = @[];
  if (plan.length > 0) {
    id json = [NSJSONSerialization JSONObjectWithData:[plan dataUsingEncoding:NSUTF8StringEncoding]
                                              options:0
                                                error:nil];
    if (![json isKindOfClass:[NSDictionary class]] || ![json[@"reminders"] isKindOfClass:[NSArray class]]) {
      reject(@"E_COMPANION", @"malformed companion reminder plan", nil);
      return;
    }
    reminders = json[@"reminders"];
  }
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center getPendingNotificationRequestsWithCompletionHandler:^(NSArray<UNNotificationRequest *> *requests) {
    NSMutableArray<NSString *> *old = [NSMutableArray array];
    for (UNNotificationRequest *request in requests) {
      if ([request.identifier hasPrefix:kCompanionPrefix]) {
        [old addObject:request.identifier];
      }
    }
    [center removePendingNotificationRequestsWithIdentifiers:old];
    NSCalendar *calendar = [NSCalendar currentCalendar];
    NSTimeInterval now = [NSDate date].timeIntervalSince1970;
    NSMutableArray<NSDictionary *> *upcoming = [NSMutableArray array];
    for (id item in reminders) {
      if (![item isKindOfClass:[NSDictionary class]] || ![item[@"id"] isKindOfClass:[NSString class]] ||
          ![item[@"title"] isKindOfClass:[NSString class]]) {
        continue;
      }
      NSTimeInterval at = AONumber(item[@"at"], 0) / 1000.0;
      NSTimeInterval until = AONumber(item[@"until"], 0) / 1000.0;
      if (at <= now || until <= at) {
        continue;
      }
      [upcoming addObject:item];
    }
    [upcoming sortUsingComparator:^NSComparisonResult(NSDictionary *a, NSDictionary *b) {
      return [a[@"at"] compare:b[@"at"]];
    }];
    NSUInteger count = MIN(upcoming.count, kMaxCompanionReminders);
    for (NSUInteger index = 0; index < count; index++) {
      NSDictionary *item = upcoming[index];
      UNMutableNotificationContent *content = [UNMutableNotificationContent new];
      content.title = item[@"title"];
      content.body = [item[@"body"] isKindOfClass:[NSString class]] ? item[@"body"] : @"";
      content.sound = [UNNotificationSound defaultSound];
      content.threadIdentifier = @"companion";
      content.categoryIdentifier = kPrivateCategory;
      content.userInfo = @{@"target" : @"companion"};
      NSDate *date = [NSDate dateWithTimeIntervalSince1970:AONumber(item[@"at"], 0) / 1000.0];
      NSDateComponents *components =
          [calendar components:(NSCalendarUnitYear | NSCalendarUnitMonth | NSCalendarUnitDay | NSCalendarUnitHour |
                                NSCalendarUnitMinute)
                      fromDate:date];
      UNCalendarNotificationTrigger *trigger =
          [UNCalendarNotificationTrigger triggerWithDateMatchingComponents:components repeats:NO];
      NSString *requestId = [NSString stringWithFormat:@"%@%@", kCompanionPrefix, item[@"id"]];
      [center addNotificationRequest:[UNNotificationRequest requestWithIdentifier:requestId
                                                                          content:content
                                                                          trigger:trigger]
               withCompletionHandler:nil];
    }
    resolve(nil);
  }];
}

- (void)consumeDoneEvaluations:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
  NSArray<NSString *> *done = [defaults stringArrayForKey:kDoneKey] ?: @[];
  [defaults removeObjectForKey:kDoneKey];
  resolve(done);
}

#pragma mark - Verificação em segundo plano

// O intervalo é o mínimo: o iOS decide quando a rodada acontece.
- (void)setPortalCheck:(BOOL)enabled
         intervalHours:(double)intervalHours
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [SharedBackgroundCheck() setPortalCheck:enabled intervalHours:intervalHours];
  resolve(nil);
}

- (void)setPortalReturnWatch:(BOOL)enabled
                     resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  [SharedBackgroundCheck() setReturnWatch:enabled];
  resolve(nil);
}

// O JS já assina os eventos: as rodadas guardadas (o app pode ter aberto só para elas) saem agora.
- (void)listenBackgroundTasks:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  __weak AppNotificationsModule *weakSelf = self;
  [SharedBackgroundCheck()
      listen:^BOOL(NSDictionary *round) {
        return [weakSelf emitBackgroundRound:round];
      }
      expire:^BOOL(NSString *roundId) {
        return [weakSelf emitBackgroundRoundExpired:roundId];
      }];
  resolve(nil);
}

- (void)setTaskCompleted:(NSString *)taskId
                 success:(BOOL)success
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [SharedBackgroundCheck() complete:taskId success:success];
  resolve(nil);
}

/** Sem a leitura a cada 15 min no iPhone: o "Me avise" da Companhia não aparece (`frequentWatches`). */
- (void)setCompanionWatch:(BOOL)enabled
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  resolve(nil);
}

/** Sem a leitura a cada 15 min no iPhone: o "ainda está lá?" do Agora no campus fica de fora (`frequentWatches`). */
- (void)setCampusWatch:(BOOL)enabled
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  resolve(nil);
}

#pragma mark - Avisos

- (void)notify:(JS::NativeAppNotifications::NativeNotification &)notification
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  UNMutableNotificationContent *content = [UNMutableNotificationContent new];
  content.title = notification.title();
  content.body = notification.body();
  content.sound = [UNNotificationSound defaultSound];
  content.threadIdentifier = notification.channel();
  content.categoryIdentifier = kPrivateCategory;
  content.userInfo = @{@"target" : notification.target()};
  // sem gatilho: mostra na hora; o mesmo id substitui o aviso anterior
  [[UNUserNotificationCenter currentNotificationCenter]
      addNotificationRequest:[UNNotificationRequest requestWithIdentifier:notification.id_() content:content trigger:nil]
       withCompletionHandler:^(NSError *error) {
         resolve(nil);
       }];
}

- (void)clearNotifications:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center removeAllPendingNotificationRequests];
  [center removeAllDeliveredNotifications];
  // os "Já fiz" não lidos eram da conta que saiu, e a validade dos semanais também
  [[NSUserDefaults standardUserDefaults] removeObjectForKey:kDoneKey];
  [[NSUserDefaults standardUserDefaults] removeObjectForKey:kWeeklyExpiresKey];
  // e o pedido de "Avisar quando voltar" também (o logout o apaga): sem isso,
  // o iOS abriria o app só para o JS descobrir que não há pedido
  [SharedBackgroundCheck() setReturnWatch:NO];
  resolve(nil);
}

#pragma mark - Aberturas

- (void)consumeLaunchTarget:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve([SharedLaunchCenter() consume]);
}

@end

/**
 * O React Native sem janela, para a rodada em segundo plano com o app
 * fechado: a fábrica abre o host como a abertura pela cena faz antes de criar
 * a tela, e a cena que se conectar depois o reusa (`createReactHostIfNeeded`
 * do `RCTRootViewFactory`). Chamada pela `AppReactNative`
 * (SceneDelegate.swift) pelo nome: o Swift não enxerga o tipo da
 * configuração do menu de desenvolvimento.
 */
@interface RCTReactNativeFactory (AOWithoutWindow)
- (void)ao_startReactNativeWithoutWindow;
@end

@implementation RCTReactNativeFactory (AOWithoutWindow)

- (void)ao_startReactNativeWithoutWindow
{
  if (self.rootViewFactory.reactHost) {
    return;
  }
  // os argumentos de startReactNativeWithModuleName:…, sem as opções de abertura (sem cena, não há)
  [self.rootViewFactory initializeReactHostWithLaunchOptions:nil
                                         bundleConfiguration:self.bundleConfiguration
                                        devMenuConfiguration:self.devMenuConfiguration];
}

@end
