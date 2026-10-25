#import <AppSpecs/AppSpecs.h>
#import <Foundation/Foundation.h>
#import <React/RCTInvalidating.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>

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

/** Lembretes de aula: prefixo dos ids, para trocá-los sem tocar nos outros avisos. */
static NSString *const kReminderPrefix = @"class:";
/** O iOS guarda só os 64 avisos agendados mais próximos; sobra folga para os outros. */
static const NSUInteger kMaxReminders = 60;
/** Categoria com o texto da tela bloqueada quando o aparelho esconde o conteúdo. */
static NSString *const kPrivateCategory = @"ao-private";

/**
 * Avisos para o JS (spec: src/specs/NativeAppNotifications.ts), como o
 * AppNotificationsModule.kt do Android, nos limites do iOS: lembretes de
 * aula agendados como avisos de data única até `expiresAt` (no máximo 60),
 * avisos na hora e as aberturas pelo toque. Sem verificação em segundo plano
 * no iPhone: `setPortalCheck` e `setPortalReturnWatch` não fazem nada.
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
    [[UNUserNotificationCenter currentNotificationCenter] setNotificationCategories:[NSSet setWithObject:category]];
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
    for (UNNotificationRequest *request in requests) {
      if ([request.identifier hasPrefix:kReminderPrefix]) {
        [old addObject:request.identifier];
      }
    }
    [center removePendingNotificationRequestsWithIdentifiers:old];
    if (parsed) {
      [self schedule:parsed center:center];
    }
    resolve(nil);
  }];
}

/**
 * Cada lembrete (1 = segunda … 7 = domingo, minutos desde 0h) nas datas de
 * agora até `expiresAt` (21 dias depois da leitura da grade), os mais
 * próximos primeiro.
 */
- (void)schedule:(NSDictionary *)plan center:(UNUserNotificationCenter *)center
{
  NSCalendar *calendar = [NSCalendar currentCalendar];
  NSDate *now = [NSDate date];
  NSTimeInterval expiresAt = [plan[@"expiresAt"] doubleValue] / 1000.0;
  NSDate *today = [calendar startOfDayForDate:now];
  NSMutableArray<NSDictionary *> *occurrences = [NSMutableArray array];
  for (id item in plan[@"reminders"]) {
    if (![item isKindOfClass:[NSDictionary class]]) {
      continue;
    }
    NSInteger weekday = [item[@"weekday"] integerValue];
    NSInteger minutes = [item[@"minutes"] integerValue];
    NSString *identifier = [item[@"id"] isKindOfClass:[NSString class]] ? item[@"id"] : nil;
    if (weekday < 1 || weekday > 7 || minutes < 0 || minutes >= 24 * 60 || !identifier) {
      continue;
    }
    // NSCalendar: 1 = domingo … 7 = sábado
    NSInteger calendarWeekday = weekday % 7 + 1;
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
  NSUInteger count = MIN(occurrences.count, kMaxReminders);
  for (NSUInteger index = 0; index < count; index++) {
    NSDictionary *occurrence = occurrences[index];
    NSDictionary *item = occurrence[@"item"];
    NSDate *date = occurrence[@"date"];
    UNMutableNotificationContent *content = [UNMutableNotificationContent new];
    content.title = [item[@"title"] isKindOfClass:[NSString class]] ? item[@"title"] : @"Aula em breve";
    content.body = [item[@"body"] isKindOfClass:[NSString class]] ? item[@"body"] : @"";
    content.sound = [UNNotificationSound defaultSound];
    content.threadIdentifier = @"class-reminders";
    content.categoryIdentifier = kPrivateCategory;
    content.userInfo = @{@"target" : @"home"};
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

// Sem verificação em segundo plano no iPhone (o iOS não garante horário).
- (void)setPortalCheck:(BOOL)enabled
         intervalHours:(double)intervalHours
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  resolve(nil);
}

- (void)setPortalReturnWatch:(BOOL)enabled
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
  resolve(nil);
}

#pragma mark - Aberturas

- (void)consumeLaunchTarget:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve([SharedLaunchCenter() consume]);
}

@end
