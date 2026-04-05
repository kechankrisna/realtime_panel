<?php

namespace Tests\Unit\Policies;

use App\Models\User;
use App\Policies\UserPolicy;
use Tests\TestCase;

class UserPolicyTest extends TestCase
{
    private UserPolicy $policy;

    protected function setUp(): void
    {
        parent::setUp();
        $this->policy = new UserPolicy();
    }

    public function test_admin_can_view_any(): void
    {
        $admin = User::factory()->admin()->make();

        $this->assertTrue($this->policy->viewAny($admin));
    }

    public function test_non_admin_cannot_view_any(): void
    {
        $user = User::factory()->make();

        $this->assertFalse($this->policy->viewAny($user));
    }

    public function test_admin_can_view_user(): void
    {
        $admin = User::factory()->admin()->make();
        $target = User::factory()->make();

        $this->assertTrue($this->policy->view($admin, $target));
    }

    public function test_non_admin_cannot_view_user(): void
    {
        $user = User::factory()->make();
        $target = User::factory()->make();

        $this->assertFalse($this->policy->view($user, $target));
    }

    public function test_admin_can_create(): void
    {
        $admin = User::factory()->admin()->make();

        $this->assertTrue($this->policy->create($admin));
    }

    public function test_non_admin_cannot_create(): void
    {
        $user = User::factory()->make();

        $this->assertFalse($this->policy->create($user));
    }

    public function test_admin_can_update(): void
    {
        $admin = User::factory()->admin()->make();
        $target = User::factory()->make();

        $this->assertTrue($this->policy->update($admin, $target));
    }

    public function test_non_admin_cannot_update(): void
    {
        $user = User::factory()->make();
        $target = User::factory()->make();

        $this->assertFalse($this->policy->update($user, $target));
    }

    public function test_admin_can_delete_other_user(): void
    {
        $admin = User::factory()->admin()->make(['id' => 1]);
        $target = User::factory()->make(['id' => 2]);

        $this->actingAs($admin);

        $this->assertTrue($this->policy->delete($admin, $target));
    }

    public function test_admin_cannot_delete_themselves(): void
    {
        $admin = User::factory()->admin()->make(['id' => 1]);

        $this->actingAs($admin);

        $this->assertFalse($this->policy->delete($admin, $admin));
    }

    public function test_non_admin_cannot_delete(): void
    {
        $user = User::factory()->make(['id' => 2]);
        $target = User::factory()->make(['id' => 3]);

        $this->actingAs($user);

        $this->assertFalse($this->policy->delete($user, $target));
    }
}
